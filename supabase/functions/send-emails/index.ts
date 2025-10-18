import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailsRequest {
  campaignId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaignId }: SendEmailsRequest = await req.json();
    console.log("Starting email send for campaign:", campaignId);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found");
    }

    // Get all pending contacts for this campaign
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      console.log("No pending contacts to send emails to");
      return new Response(
        JSON.stringify({ message: "No pending contacts", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${contacts.length} pending contacts`);

    let sentCount = 0;
    let failedCount = 0;

    // Send emails to each contact
    for (const contact of contacts) {
      try {
        // Personalize the email body
        let personalizedBody = campaign.body_template;
        personalizedBody = personalizedBody.replace(/\{\{first_name\}\}/g, contact.first_name || "");
        personalizedBody = personalizedBody.replace(/\{\{last_name\}\}/g, contact.last_name || "");
        personalizedBody = personalizedBody.replace(/\{\{company\}\}/g, contact.company || "");
        personalizedBody = personalizedBody.replace(/\{\{email\}\}/g, contact.email || "");

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: "Campaign <onboarding@resend.dev>",
          to: [contact.email],
          subject: campaign.subject,
          html: personalizedBody,
        });

        console.log(`Email sent to ${contact.email}:`, emailResponse);

        // Update contact status to sent
        await supabase
          .from("contacts")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", contact.id);

        sentCount++;
      } catch (error: any) {
        console.error(`Failed to send email to ${contact.email}:`, error);

        // Update contact status to failed
        await supabase
          .from("contacts")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", contact.id);

        failedCount++;
      }
    }

    // Update campaign counts
    const { data: updatedCampaign } = await supabase
      .from("campaigns")
      .update({
        sent_count: campaign.sent_count + sentCount,
        failed_count: campaign.failed_count + failedCount,
        pending_count: campaign.pending_count - (sentCount + failedCount),
        status: "completed",
      })
      .eq("id", campaignId)
      .select()
      .single();

    console.log(`Campaign completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        campaign: updatedCampaign,
      }),
      {
        status: 200,
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
