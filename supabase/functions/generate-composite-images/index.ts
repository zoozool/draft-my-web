import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompositeRequest {
  campaignId: string;
  baseImageUrl?: string;
}

// Generate composite using AI - simplified version
async function compositeImages(
  baseImageUrl: string,
  logoUrl: string,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number
): Promise<Uint8Array> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  console.log(`Compositing: base=${baseImageUrl.substring(0, 50)}..., logo=${logoUrl.substring(0, 50)}...`);

  // Use AI to composite - pass URLs directly instead of converting to base64
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Take the base image and overlay the logo at position (${targetX}, ${targetY}). The logo should be resized to fit within ${targetWidth}x${targetHeight} pixels while maintaining aspect ratio. Center it within that area. The logo URL is: ${logoUrl}`
          },
          {
            type: "image_url",
            image_url: { url: baseImageUrl }
          }
        ]
      }],
      modalities: ["image", "text"]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const compositeBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!compositeBase64) {
    throw new Error("No image returned from AI");
  }

  // Convert base64 to buffer
  const base64Data = compositeBase64.split(",")[1];
  return Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
}

// Default base image generator
async function generateBaseImage(
  topLeftX: number,
  topLeftY: number,
  bottomRightX: number,
  bottomRightY: number
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  console.log("Generating base image with AI...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [{
        role: "user",
        content: `Create a professional email background image 1920x1080 pixels. Add a solid white (#FFFFFF) rectangle from pixel (${topLeftX}, ${topLeftY}) to (${bottomRightX}, ${bottomRightY}). Use a subtle blue-gray gradient for the rest.`
      }],
      modalities: ["image", "text"]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-composite-images invoked at", new Date().toISOString());

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: CompositeRequest = await req.json();
    const { campaignId, baseImageUrl } = body;

    // Default coordinates
    const targetX = 888;
    const targetY = 500;
    const targetWidth = 313;
    const targetHeight = 226;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Missing campaignId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch contacts needing composite generation
    const { data: contacts, error: contactsError } = await supabaseClient
      .from("contacts")
      .select("*")
      .eq("campaign_id", campaignId)
      .not("logo_url", "is", null)
      .is("composite_image_url", null);

    if (contactsError) throw contactsError;

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No contacts need image generation",
          processed: 0,
          successful: 0,
          failed: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${contacts.length} contacts`);

    // Get or generate base image
    let finalBaseImageUrl = baseImageUrl;
    if (!finalBaseImageUrl) {
      console.log("No base image provided, generating...");
      finalBaseImageUrl = await generateBaseImage(targetX, targetY, targetX + targetWidth, targetY + targetHeight);
      console.log("Base image generated");
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        console.log(`[${contact.email}] Compositing logo: ${contact.logo_url}`);

        // Generate composite
        const compositeBuffer = await compositeImages(
          finalBaseImageUrl,
          contact.logo_url,
          targetX,
          targetY,
          targetWidth,
          targetHeight
        );

        // Upload to storage
        const fileName = `${contact.id}-${Date.now()}.png`;
        const { error: uploadError } = await supabaseClient
          .storage
          .from("logos")
          .upload(`composites/${fileName}`, compositeBuffer, {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabaseClient
          .storage
          .from("logos")
          .getPublicUrl(`composites/${fileName}`);

        // Update contact
        const { error: updateError } = await supabaseClient
          .from("contacts")
          .update({ composite_image_url: urlData.publicUrl })
          .eq("id", contact.id);

        if (updateError) throw updateError;

        console.log(`[${contact.email}] ✅ Success: ${urlData.publicUrl}`);
        successCount++;

      } catch (error: any) {
        console.error(`[${contact.email}] ❌ Error:`, error.message);
        failCount++;
        errors.push(`${contact.email}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount + failCount,
        successful: successCount,
        failed: failCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in generate-composite-images:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
