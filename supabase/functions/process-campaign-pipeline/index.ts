import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PipelineRequest {
  campaignId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId }: PipelineRequest = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "campaignId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Pipeline] Starting automated processing for campaign ${campaignId}`);

    // Step 1: Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, user_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("[Pipeline] Campaign not found:", campaignError);
      await supabase
        .from("campaigns")
        .update({ processing_status: "error" })
        .eq("id", campaignId);
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Check how many contacts need composite images
    const { count: pendingComposites } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("logo_url", "is", null)
      .is("composite_image_url", null);

    console.log(`[Pipeline] Found ${pendingComposites} contacts needing composite images`);

    let totalImagesProcessed = 0;

    // Step 3: Generate composite images if needed
    if (pendingComposites && pendingComposites > 0) {
      console.log("[Pipeline] Starting image generation...");
      
      await supabase
        .from("campaigns")
        .update({ processing_status: "processing_images" })
        .eq("id", campaignId);

      // Get batch size from SMTP settings
      const { data: smtpSettings } = await supabase
        .from("smtp_settings")
        .select("composite_batch_size")
        .eq("user_id", campaign.user_id)
        .single();

      const batchSize = smtpSettings?.composite_batch_size || 20;

      // Process images in batches
      let remainingToProcess = pendingComposites;

      while (remainingToProcess > 0) {
        const currentBatch = Math.min(batchSize, remainingToProcess);
        
        console.log(`[Pipeline] Processing batch: ${currentBatch} images`);

        const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-composite-images`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            campaignId,
            baseImageUrl: campaign.base_image_url,
            limit: currentBatch,
          }),
        });

        if (!generateResponse.ok) {
          const errorText = await generateResponse.text();
          console.error("[Pipeline] Image generation failed:", errorText);
          break;
        }

        const generateResult = await generateResponse.json();
        totalImagesProcessed += generateResult.processed || 0;
        
        // Check if there are more to process
        const { count: stillPending } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .not("logo_url", "is", null)
          .is("composite_image_url", null);

        remainingToProcess = stillPending || 0;

        if (remainingToProcess === 0) break;

        // Small delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[Pipeline] Completed image generation: ${totalImagesProcessed} images processed`);
    }

    // Step 4: Send emails
    console.log("[Pipeline] Starting email sending...");
    
    await supabase
      .from("campaigns")
      .update({ processing_status: "sending_emails" })
      .eq("id", campaignId);

    const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ campaignId }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("[Pipeline] Email sending failed:", errorText);
      
      await supabase
        .from("campaigns")
        .update({ processing_status: "error" })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Email sending failed",
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendResult = await sendResponse.json();

    // Step 5: Mark campaign as completed
    console.log("[Pipeline] Pipeline completed successfully");
    
    await supabase
      .from("campaigns")
      .update({ 
        processing_status: "completed",
        last_processed_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campaign pipeline completed successfully",
        imagesProcessed: totalImagesProcessed,
        emailsSent: sendResult.totalSent || 0,
        emailsFailed: sendResult.totalFailed || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Pipeline] Fatal error:", error);
    
    const { campaignId } = await req.json().catch(() => ({ campaignId: null }));
    if (campaignId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from("campaigns")
        .update({ processing_status: "error" })
        .eq("id", campaignId);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
