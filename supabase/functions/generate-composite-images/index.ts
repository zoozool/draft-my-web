import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompositeRequest {
  campaignId: string;
  baseImageUrl?: string; // URL to bazowy.jpg or leave empty to use default
}

interface Point {
  x: number;
  y: number;
}

// Calculate perspective transformation matrix
function calculatePerspectiveTransform(
  sourceCorners: Point[],
  destCorners: Point[]
): number[][] {
  // Simplified perspective transform using bilinear interpolation
  // For production, you'd use a full perspective transformation matrix
  const [tl, tr, br, bl] = destCorners;
  
  // Calculate the bounding box of the destination quadrilateral
  const minX = Math.min(tl.x, tr.x, br.x, bl.x);
  const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
  const minY = Math.min(tl.y, tr.y, br.y, bl.y);
  const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
  
  return [[minX, minY, maxX - minX, maxY - minY]];
}

// Composite logo onto base image at specified quadrilateral coordinates
async function compositeLogoOntoBase(
  baseImageUrl: string,
  logoUrl: string,
  destCorners: Point[]
): Promise<Uint8Array> {
  console.log("Downloading base image...");
  const baseResponse = await fetch(baseImageUrl);
  if (!baseResponse.ok) throw new Error(`Failed to fetch base image: ${baseResponse.status}`);
  const baseBuffer = await baseResponse.arrayBuffer();
  const baseImage = await Image.decode(new Uint8Array(baseBuffer));

  console.log("Downloading logo...");
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error(`Failed to fetch logo: ${logoResponse.status}`);
  const logoBuffer = await logoResponse.arrayBuffer();
  const logoImage = await Image.decode(new Uint8Array(logoBuffer));

  // Calculate bounding box of the destination quadrilateral
  const [tl, tr, br, bl] = destCorners;
  const minX = Math.floor(Math.min(tl.x, tr.x, br.x, bl.x));
  const maxX = Math.ceil(Math.max(tl.x, tr.x, br.x, bl.x));
  const minY = Math.floor(Math.min(tl.y, tr.y, br.y, bl.y));
  const maxY = Math.ceil(Math.max(tl.y, tr.y, br.y, bl.y));
  
  const targetWidth = maxX - minX;
  const targetHeight = maxY - minY;

  console.log(`Target area: ${targetWidth}x${targetHeight} at (${minX}, ${minY})`);

  // Resize logo to fit target area while maintaining aspect ratio
  const logoAspect = logoImage.width / logoImage.height;
  const targetAspect = targetWidth / targetHeight;
  
  let resizedWidth: number, resizedHeight: number;
  if (logoAspect > targetAspect) {
    // Logo is wider - fit to width
    resizedWidth = targetWidth;
    resizedHeight = Math.floor(targetWidth / logoAspect);
  } else {
    // Logo is taller - fit to height
    resizedHeight = targetHeight;
    resizedWidth = Math.floor(targetHeight * logoAspect);
  }

  console.log(`Resizing logo from ${logoImage.width}x${logoImage.height} to ${resizedWidth}x${resizedHeight}`);
  const resizedLogo = logoImage.resize(resizedWidth, resizedHeight);

  // Center the resized logo within the target area
  const offsetX = minX + Math.floor((targetWidth - resizedWidth) / 2);
  const offsetY = minY + Math.floor((targetHeight - resizedHeight) / 2);

  console.log(`Placing logo at (${offsetX}, ${offsetY})`);

  // Composite the logo onto the base image
  baseImage.composite(resizedLogo, offsetX, offsetY);

  // Encode as PNG
  console.log("Encoding final image...");
  return await baseImage.encode();
}

// Get or create base image with white rectangle
async function getOrCreateBaseImage(
  baseImageUrl: string | undefined,
  destCorners: Point[]
): Promise<string> {
  // If user provides bazowy.jpg URL, use it
  if (baseImageUrl) {
    return baseImageUrl;
  }

  // Otherwise, generate a default base image with white rectangle
  console.log("No base image provided, generating default with white rectangle...");
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured - needed to generate base image");
  }

  const [tl, tr, br, bl] = destCorners;
  
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
        content: `Create a professional email background image 1920x1080 pixels. Draw a solid white (#FFFFFF) quadrilateral with corners at exact pixel coordinates: top-left (${tl.x},${tl.y}), top-right (${tr.x},${tr.y}), bottom-right (${br.x},${br.y}), bottom-left (${bl.x},${bl.y}). The rest should be a subtle blue-gray gradient. The white area must have sharp edges and be perfectly white.`
      }],
      modalities: ["image", "text"]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate base image: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageUrl) {
    throw new Error("No image URL returned from AI");
  }

  return imageUrl;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Generate Composite Images ===");
    console.log("Invoked at:", new Date().toISOString());

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: CompositeRequest = await req.json();
    const { campaignId, baseImageUrl } = body;

    // Define the white rectangle coordinates (quadrilateral)
    // TL (888,500), TR (1201,493), BR (1198,724), BL (886,726)
    const destCorners: Point[] = [
      { x: 888, y: 500 },   // Top-Left
      { x: 1201, y: 493 },  // Top-Right
      { x: 1198, y: 724 },  // Bottom-Right
      { x: 886, y: 726 }    // Bottom-Left
    ];

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Missing campaignId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Campaign ID:", campaignId);
    console.log("Destination corners:", destCorners);

    // Fetch contacts needing composite generation
    const { data: contacts, error: contactsError } = await supabaseClient
      .from("contacts")
      .select("*")
      .eq("campaign_id", campaignId)
      .not("logo_url", "is", null)
      .is("composite_image_url", null);

    if (contactsError) throw contactsError;

    if (!contacts || contacts.length === 0) {
      console.log("No contacts need image generation");
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

    // Get or create base image (bazowy.jpg or default)
    const finalBaseImageUrl = await getOrCreateBaseImage(baseImageUrl, destCorners);
    console.log("Base image ready:", finalBaseImageUrl.substring(0, 100) + "...");

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        console.log(`\n[${contact.email}] Starting...`);
        console.log(`[${contact.email}] Logo URL: ${contact.logo_url}`);
        console.log(`[${contact.email}] Company: ${contact.company || 'N/A'}`);

        // Composite logo onto base image
        const compositeBuffer = await compositeLogoOntoBase(
          finalBaseImageUrl,
          contact.logo_url,
          destCorners
        );

        console.log(`[${contact.email}] Composite generated, uploading...`);

        // Upload to Supabase Storage
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

        console.log(`[${contact.email}] Uploaded: ${urlData.publicUrl}`);

        // Update contact with composite_image_url
        const { error: updateError } = await supabaseClient
          .from("contacts")
          .update({ composite_image_url: urlData.publicUrl })
          .eq("id", contact.id);

        if (updateError) throw updateError;

        console.log(`[${contact.email}] ✅ SUCCESS`);
        successCount++;

      } catch (error: any) {
        console.error(`[${contact.email}] ❌ ERROR:`, error.message);
        failCount++;
        errors.push(`${contact.email}: ${error.message}`);
      }
    }

    console.log("\n=== Summary ===");
    console.log(`Total processed: ${successCount + failCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);

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
    console.error("❌ FATAL ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
