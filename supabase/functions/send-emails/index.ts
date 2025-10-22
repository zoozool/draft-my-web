import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { campaignId }: SendEmailsRequest = body || {};

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
          personalizedBody = personalizedBody.replace(/\{\{first_name\}\}/g, contact.first_name || "");
          personalizedBody = personalizedBody.replace(/\{\{last_name\}\}/g, contact.last_name || "");
          personalizedBody = personalizedBody.replace(/\{\{company\}\}/g, contact.company || "");
          personalizedBody = personalizedBody.replace(/\{\{email\}\}/g, contact.email);

          console.log(`[${contact.email}] Starting email send process...`);
          console.log(`[${contact.email}] Subject: ${campaign.subject}`);
          console.log(`[${contact.email}] Body preview: ${personalizedBody.substring(0, 100)}...`);

          // Send email using Resend
          const { data, error } = await resend.emails.send({
            from: "Campaign <onboarding@resend.dev>",
            to: [contact.email],
            subject: campaign.subject,
            html: personalizedBody,
          });

          if (error) {
            console.error(`[${contact.email}] ❌ FAILED - Resend API Error:`, JSON.stringify(error, null, 2));
            console.error(`[${contact.email}] Error name: ${error.name}`);
            console.error(`[${contact.email}] Error message: ${error.message}`);
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
