import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Point {
  x: number;
  y: number;
}

interface CompositeRequest {
  campaignId: string;
  baseImageUrl?: string; // Optional: URL to base image
  coordinates?: {
    topLeft: Point;
    topRight: Point;
    bottomRight: Point;
    bottomLeft: Point;
  };
  simpleMode?: boolean; // If true, use simple rectangle placement
  targetWidth?: number;
  targetHeight?: number;
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
    const { 
      campaignId, 
      baseImageUrl,
      coordinates = {
        topLeft: { x: 888, y: 500 },
        topRight: { x: 1201, y: 493 },
        bottomRight: { x: 1198, y: 724 },
        bottomLeft: { x: 886, y: 726 }
      },
      simpleMode = true,
      targetWidth = 313,
      targetHeight = 226
    } = body;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Missing campaignId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all contacts for this campaign that need image generation
    const { data: contacts, error: contactsError } = await supabaseClient
      .from("contacts")
      .select("*")
      .eq("campaign_id", campaignId)
      .is("composite_image_url", null); // Only process contacts without generated images

    if (contactsError) throw contactsError;

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No contacts need image generation",
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${contacts.length} contacts for composite image generation`);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        if (!contact.logo_url) {
          console.log(`[${contact.email}] No logo URL, skipping`);
          continue;
        }

        console.log(`[${contact.email}] Generating composite with logo: ${contact.logo_url}`);

        // In a real implementation, you would:
        // 1. Fetch the base image
        // 2. Fetch the logo image
        // 3. Use a library like sharp (not available in Deno) or call an external service
        // 4. Composite the images
        // 5. Upload to storage
        // 6. Update the contact with the composite_image_url

        // For now, we'll demonstrate the flow with the Lovable AI image editing API
        // This generates a composite by describing what we want

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        
        if (!LOVABLE_API_KEY) {
          console.log("LOVABLE_API_KEY not set, skipping AI generation");
          // Fallback to using logo URL directly
          await supabaseClient
            .from("contacts")
            .update({ composite_image_url: contact.logo_url })
            .eq("id", contact.id);
          successCount++;
          continue;
        }

        // Use Lovable AI to composite the logo onto the base image
        let imageToUse = baseImageUrl;
        
        if (!imageToUse) {
          // Generate a base image with white rectangle area if not provided
          const baseImageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [{
                role: "user",
                content: `Create a professional email background image (1920x1080) with a clean white rectangular area at coordinates from top-left (${coordinates.topLeft.x},${coordinates.topLeft.y}) to bottom-right (${coordinates.bottomRight.x},${coordinates.bottomRight.y}). The rectangle should be clearly defined and ready for logo placement. Use a subtle gradient background.`
              }],
              modalities: ["image", "text"]
            })
          });

          const baseImageData = await baseImageResponse.json();
          imageToUse = baseImageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        }

        if (!imageToUse) {
          throw new Error("Failed to get base image");
        }

        // Now composite the logo onto the base image
        const compositeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  text: `Place the logo from ${contact.logo_url} into the white rectangle area, centered and properly scaled to fit within ${targetWidth}x${targetHeight} pixels while maintaining aspect ratio. The logo should be clearly visible and professional.`
                },
                {
                  type: "image_url",
                  image_url: { url: imageToUse }
                }
              ]
            }],
            modalities: ["image", "text"]
          })
        });

        const compositeData = await compositeResponse.json();
        const compositeImageBase64 = compositeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!compositeImageBase64) {
          throw new Error("Failed to generate composite image");
        }

        // Upload to Supabase Storage
        const fileName = `${contact.id}-composite.png`;
        const base64Data = compositeImageBase64.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        const { data: uploadData, error: uploadError } = await supabaseClient
          .storage
          .from("logos")
          .upload(`composites/${fileName}`, imageBuffer, {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabaseClient
          .storage
          .from("logos")
          .getPublicUrl(`composites/${fileName}`);

        // Update contact with composite image URL
        const { error: updateError } = await supabaseClient
          .from("contacts")
          .update({ composite_image_url: urlData.publicUrl })
          .eq("id", contact.id);

        if (updateError) throw updateError;

        console.log(`[${contact.email}] ✅ Composite image generated: ${urlData.publicUrl}`);
        successCount++;

      } catch (error: any) {
        console.error(`[${contact.email}] ❌ Failed to generate composite:`, error);
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
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Error in generate-composite-images function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
};

serve(handler);
