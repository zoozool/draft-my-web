import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Helper function to send email via SMTP
async function sendViaSMTP(
  settings: any,
  to: string,
  subject: string,
  html: string
) {
  const conn = await Deno.connect({
    hostname: settings.smtp_host,
    port: settings.smtp_port,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(4096);

  try {
    // Read greeting
    await conn.read(buffer);

    // Send EHLO
    await conn.write(encoder.encode(`EHLO ${settings.smtp_host}\r\n`));
    await conn.read(buffer);

    let activeConn: Deno.TcpConn | Deno.TlsConn = conn;

    // Handle TLS
    if (settings.use_tls && settings.smtp_port !== 465) {
      await conn.write(encoder.encode("STARTTLS\r\n"));
      await conn.read(buffer);
      
      const tlsConn = await Deno.startTls(conn, { hostname: settings.smtp_host });
      activeConn = tlsConn;
      
      await tlsConn.write(encoder.encode(`EHLO ${settings.smtp_host}\r\n`));
      await tlsConn.read(buffer);
    }

    // AUTH LOGIN
    await activeConn.write(encoder.encode("AUTH LOGIN\r\n"));
    await activeConn.read(buffer);

    await activeConn.write(encoder.encode(`${btoa(settings.smtp_username)}\r\n`));
    await activeConn.read(buffer);

    await activeConn.write(encoder.encode(`${btoa(settings.smtp_password)}\r\n`));
    await activeConn.read(buffer);

    // MAIL FROM
    await activeConn.write(encoder.encode(`MAIL FROM:<${settings.smtp_from_email}>\r\n`));
    await activeConn.read(buffer);

    // RCPT TO
    await activeConn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
    await activeConn.read(buffer);

    // DATA
    await activeConn.write(encoder.encode("DATA\r\n"));
    await activeConn.read(buffer);

    // Email content
    const emailContent = [
      `From: ${settings.smtp_from_name} <${settings.smtp_from_email}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
      ".",
      ""
    ].join("\r\n");

    await activeConn.write(encoder.encode(emailContent));
    await activeConn.read(buffer);

    // QUIT
    await activeConn.write(encoder.encode("QUIT\r\n"));
    activeConn.close();
  } catch (error) {
    conn.close();
    throw error;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailsRequest {
  campaignId?: string; // Optional - if not provided, processes all eligible campaigns
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const envCheck = {
      hasResendApiKey: Boolean(Deno.env.get("RESEND_API_KEY")),
      hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
      hasServiceRole: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    };
    console.log("send-emails invoked", {
      method: req.method,
      at: new Date().toISOString(),
      envCheck,
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { campaignId }: SendEmailsRequest = body || {};

    // Get user SMTP settings if available
    let smtpSettings = null;
    
    const { data: allCampaigns } = await supabaseClient
      .from("campaigns")
      .select("user_id")
      .limit(1);
    
    if (allCampaigns && allCampaigns.length > 0) {
      const { data: settings } = await supabaseClient
        .from("smtp_settings")
        .select("*")
        .eq("user_id", allCampaigns[0].user_id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (settings) {
        smtpSettings = settings;
        console.log("Using SMTP settings for user:", allCampaigns[0].user_id);
      }
    }

    // If no campaignId provided, find all campaigns that need processing
    let campaignIds: string[] = [];
    
    if (campaignId) {
      campaignIds = [campaignId];
      console.log("Processing emails for specific campaign:", campaignId);
    } else {
      // Find all campaigns with status 'active' and pending contacts
      const { data: eligibleCampaigns, error: campaignsError } = await supabaseClient
        .from("campaigns")
        .select("id")
        .eq("status", "active")
        .gt("pending_count", 0);

      if (campaignsError) {
        throw campaignsError;
      }

      campaignIds = eligibleCampaigns?.map(c => c.id) || [];
      console.log(`Found ${campaignIds.length} campaigns to process`);
    }

    if (campaignIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No campaigns to process", processed: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results = [];

    for (const currentCampaignId of campaignIds) {
      console.log("Processing campaign:", currentCampaignId);

      // Fetch campaign details
      const { data: campaign, error: campaignError } = await supabaseClient
        .from("campaigns")
        .select("*")
        .eq("id", currentCampaignId)
        .single();

      if (campaignError) {
        console.error(`Error fetching campaign ${currentCampaignId}:`, campaignError);
        results.push({ campaignId: currentCampaignId, error: campaignError.message });
        continue;
      }

      console.log("Campaign found:", campaign.name);
      console.log("Email 'from' used:", "Campaign <onboarding@resend.dev>", "Subject:", campaign.subject);

      // Fetch pending contacts
      const { data: contacts, error: contactsError } = await supabaseClient
        .from("contacts")
        .select("*")
        .eq("campaign_id", currentCampaignId)
        .eq("status", "pending")
        .limit(50); // Process in batches of 50

      if (contactsError) {
        console.error(`Error fetching contacts for campaign ${currentCampaignId}:`, contactsError);
        results.push({ campaignId: currentCampaignId, error: contactsError.message });
        continue;
      }

      console.log(`Found ${contacts?.length || 0} pending contacts`);

      let sentCount = 0;
      let failedCount = 0;

      // Send emails to each contact
      for (const contact of contacts || []) {
        try {
          // Personalize email body
          let personalizedBody = campaign.body_template;
          personalizedBody = personalizedBody.replace(/\{\{first_name\}\}/gi, contact.first_name || "");
          personalizedBody = personalizedBody.replace(/\{\{last_name\}\}/gi, contact.last_name || "");
          personalizedBody = personalizedBody.replace(/\{\{company\}\}/gi, contact.company || "");
          personalizedBody = personalizedBody.replace(/\{\{email\}\}/gi, contact.email);
          personalizedBody = personalizedBody.replace(/\{\{contact\}\}/gi, `${contact.first_name || ""} ${contact.last_name || ""}`.trim());
          
          // Use composite image if available, fallback to logo URL
          const imageUrl = contact.composite_image_url || contact.logo_url || "";
          personalizedBody = personalizedBody.replace(/\{\{composite_image\}\}/gi, imageUrl);
          personalizedBody = personalizedBody.replace(/\{\{logo_url\}\}/gi, contact.logo_url || "");
          personalizedBody = personalizedBody.replace(/\{\{INLINE_CID\}\}/gi, imageUrl);

          console.log(`[${contact.email}] Starting email send process...`);
          console.log(`[${contact.email}] Subject: ${campaign.subject}`);
          console.log(`[${contact.email}] Body preview: ${personalizedBody.substring(0, 100)}...`);

          let sendError = null;
          let sendData = null;

          // Send email using SMTP or Resend
          if (smtpSettings) {
            try {
              console.log(`[${contact.email}] Sending via SMTP to ${smtpSettings.smtp_host}`);
              
              // Use native SMTP sending
              await sendViaSMTP(
                smtpSettings,
                contact.email,
                campaign.subject,
                personalizedBody
              );
              
              sendData = { id: "smtp-" + Date.now() };
              console.log(`[${contact.email}] ✅ SMTP send successful`);
            } catch (err: any) {
              console.error(`[${contact.email}] ❌ SMTP send failed:`, err);
              sendError = { message: err.message };
            }
          } else {
            // Fallback to Resend
            console.log(`[${contact.email}] Sending via Resend`);
            const result = await resend.emails.send({
              from: "Campaign <onboarding@resend.dev>",
              to: [contact.email],
              subject: campaign.subject,
              html: personalizedBody,
            });
            sendData = result.data;
            sendError = result.error;
          }

          const error = sendError;
          const data = sendData;

          if (error) {
            console.error(`[${contact.email}] ❌ FAILED - Email Send Error:`, JSON.stringify(error, null, 2));
            console.error(`[${contact.email}] Error name: ${(error as any).name ?? "unknown"}`);
            console.error(`[${contact.email}] Error message: ${error.message}`);
            console.error(`[${contact.email}] Error statusCode: ${(error as any).statusCode ?? "unknown"}`);
            console.error(`[${contact.email}] Hint: Verify email configuration and credentials`);
            failedCount++;
            
            // Update contact status to failed
            const updateResult = await supabaseClient
              .from("contacts")
              .update({ 
                status: "failed",
                error_message: error.message || JSON.stringify(error)
              })
              .eq("id", contact.id);
            
            if (updateResult.error) {
              console.error(`[${contact.email}] Failed to update contact status:`, updateResult.error);
            }
          } else {
            console.log(`[${contact.email}] ✅ SUCCESS - Email sent! Resend ID: ${data?.id}`);
            sentCount++;
            
            // Update contact status to sent
            const updateResult = await supabaseClient
              .from("contacts")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", contact.id);
            
            if (updateResult.error) {
              console.error(`[${contact.email}] Failed to update contact status:`, updateResult.error);
            }
          }
        } catch (error: any) {
          console.error(`[${contact.email}] ❌ EXCEPTION - Unexpected error:`, error);
          console.error(`[${contact.email}] Error type: ${typeof error}`);
          console.error(`[${contact.email}] Error details:`, JSON.stringify(error, null, 2));
          console.error(`[${contact.email}] Stack trace:`, error.stack);
          failedCount++;
          
          // Update contact status to failed
          const updateResult = await supabaseClient
            .from("contacts")
            .update({ 
              status: "failed",
              error_message: error.message || String(error)
            })
            .eq("id", contact.id);
          
          if (updateResult.error) {
            console.error(`[${contact.email}] Failed to update contact status:`, updateResult.error);
          }
        }
      }

      // Update campaign statistics
      const newSentCount = (campaign.sent_count || 0) + sentCount;
      const newFailedCount = (campaign.failed_count || 0) + failedCount;
      const newPendingCount = Math.max(0, (campaign.pending_count || 0) - (sentCount + failedCount));

      const { error: updateError } = await supabaseClient
        .from("campaigns")
        .update({
          sent_count: newSentCount,
          failed_count: newFailedCount,
          pending_count: newPendingCount,
          status: newPendingCount === 0 ? "completed" : "active",
        })
        .eq("id", currentCampaignId);

      if (updateError) {
        console.error("Error updating campaign:", updateError);
        results.push({ campaignId: currentCampaignId, error: updateError.message });
        continue;
      }

      console.log(`Campaign ${currentCampaignId} processed: ${sentCount} sent, ${failedCount} failed`);

      results.push({
        campaignId: currentCampaignId,
        success: true,
        sent: sentCount,
        failed: failedCount,
        status: newPendingCount === 0 ? "completed" : "active",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results: results,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-emails function:", error);
    console.error("Error name:", error?.name);
    console.error("Stack:", error?.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
