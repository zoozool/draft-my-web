import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
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
  destCorners: Point[],
  contactEmail: string
): Promise<Uint8Array> {
  try {
    console.log(`[${contactEmail}] Downloading base image from: ${baseImageUrl.substring(0, 100)}...`);
    const baseResponse = await fetch(baseImageUrl);
    if (!baseResponse.ok) {
      throw new Error(`Failed to fetch base image: HTTP ${baseResponse.status} ${baseResponse.statusText}`);
    }
    const baseBuffer = await baseResponse.arrayBuffer();
    console.log(`[${contactEmail}] Base image downloaded: ${baseBuffer.byteLength} bytes`);
    
    console.log(`[${contactEmail}] Decoding base image...`);
    const baseImage = await Image.decode(new Uint8Array(baseBuffer));
    console.log(`[${contactEmail}] Base image decoded: ${baseImage.width}x${baseImage.height}`);

    console.log(`[${contactEmail}] Downloading logo from: ${logoUrl}`);
    const logoResponse = await fetch(logoUrl);
    if (!logoResponse.ok) {
      throw new Error(`Failed to fetch logo: HTTP ${logoResponse.status} ${logoResponse.statusText} - URL: ${logoUrl}`);
    }
    const logoBuffer = await logoResponse.arrayBuffer();
    console.log(`[${contactEmail}] Logo downloaded: ${logoBuffer.byteLength} bytes, Content-Type: ${logoResponse.headers.get('content-type')}`);
    
    console.log(`[${contactEmail}] Decoding logo...`);
    let logoImage: Image;
    
    try {
      logoImage = await Image.decode(new Uint8Array(logoBuffer));
    } catch (decodeError: any) {
      // If ImageScript can't decode (e.g., WebP), try converting via browser-compatible formats
      console.warn(`[${contactEmail}] ImageScript decode failed (${decodeError.message}), attempting fallback conversion...`);
      
      // Check if it's a WebP or other unsupported format
      const contentType = logoResponse.headers.get('content-type') || '';
      if (contentType.includes('webp') || logoUrl.toLowerCase().endsWith('.webp')) {
        throw new Error(`WebP format not supported by ImageScript. Please convert logo to PNG or JPEG format. Logo URL: ${logoUrl}`);
      }
      
      throw new Error(`Unsupported image format (${contentType}). Please use PNG, JPEG, or GIF. Logo URL: ${logoUrl}`);
    }
    
    console.log(`[${contactEmail}] Logo decoded: ${logoImage.width}x${logoImage.height}`);

    // Calculate bounding box of the destination quadrilateral
    const [tl, tr, br, bl] = destCorners;
    const minX = Math.floor(Math.min(tl.x, tr.x, br.x, bl.x));
    const maxX = Math.ceil(Math.max(tl.x, tr.x, br.x, bl.x));
    const minY = Math.floor(Math.min(tl.y, tr.y, br.y, bl.y));
    const maxY = Math.ceil(Math.max(tl.y, tr.y, br.y, bl.y));
    
    const targetWidth = maxX - minX;
    const targetHeight = maxY - minY;

    console.log(`[${contactEmail}] Target area: ${targetWidth}x${targetHeight} at (${minX}, ${minY})`);

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

    console.log(`[${contactEmail}] Resizing logo from ${logoImage.width}x${logoImage.height} to ${resizedWidth}x${resizedHeight}`);
    const resizedLogo = logoImage.resize(resizedWidth, resizedHeight);

    // Center the resized logo within the target area
    const offsetX = minX + Math.floor((targetWidth - resizedWidth) / 2);
    const offsetY = minY + Math.floor((targetHeight - resizedHeight) / 2);

    console.log(`[${contactEmail}] Placing logo at (${offsetX}, ${offsetY})`);

    // Composite the logo onto the base image
    baseImage.composite(resizedLogo, offsetX, offsetY);

    // Encode as PNG
    console.log(`[${contactEmail}] Encoding final image...`);
    const encoded = await baseImage.encode();
    console.log(`[${contactEmail}] Final image encoded: ${encoded.byteLength} bytes`);
    
    return encoded;
  } catch (error: any) {
    console.error(`[${contactEmail}] ❌ COMPOSITE ERROR:`, {
      message: error.message,
      stack: error.stack,
      logoUrl,
      baseImageUrl: baseImageUrl.substring(0, 100)
    });
    throw error;
  }
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
      .is("composite_image_url", null)
      .limit(20); // Process max 20 contacts per invocation to avoid timeout

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

    // Filter out contacts with empty or invalid logo URLs
    const validContacts = contacts.filter(c => {
      const url = c.logo_url?.trim();
      if (!url || url === '') {
        console.log(`[${c.email}] Skipping - empty logo URL`);
        return false;
      }
      // Skip SVG files as they're not supported
      if (url.toLowerCase().endsWith('.svg') || url.includes('.svg?')) {
        console.log(`[${c.email}] Skipping - SVG format not supported: ${url}`);
        return false;
      }
      return true;
    });

    console.log(`Processing ${validContacts.length} valid contacts (filtered from ${contacts.length} total)`);

    // Get or create base image (bazowy.jpg or default)
    const finalBaseImageUrl = await getOrCreateBaseImage(baseImageUrl, destCorners);
    console.log("Base image ready:", finalBaseImageUrl.substring(0, 100) + "...");

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const contact of validContacts) {
      try {
        console.log(`\n[${contact.email}] ===== Starting composite generation =====`);
        console.log(`[${contact.email}] Contact ID: ${contact.id}`);
        console.log(`[${contact.email}] Logo URL: ${contact.logo_url}`);
        console.log(`[${contact.email}] Company: ${contact.company || 'N/A'}`);

        // Composite logo onto base image
        const compositeBuffer = await compositeLogoOntoBase(
          finalBaseImageUrl,
          contact.logo_url,
          destCorners,
          contact.email
        );

        console.log(`[${contact.email}] Composite generated successfully, uploading to storage...`);

        // Upload to Supabase Storage
        const fileName = `${contact.id}-${Date.now()}.png`;
        const { error: uploadError } = await supabaseClient
          .storage
          .from("logos")
          .upload(`composites/${fileName}`, compositeBuffer, {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) {
          console.error(`[${contact.email}] ❌ Upload error:`, uploadError);
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabaseClient
          .storage
          .from("logos")
          .getPublicUrl(`composites/${fileName}`);

        console.log(`[${contact.email}] Uploaded to: ${urlData.publicUrl}`);

        // Update contact with composite_image_url
        const { error: updateError } = await supabaseClient
          .from("contacts")
          .update({ composite_image_url: urlData.publicUrl })
          .eq("id", contact.id);

        if (updateError) {
          console.error(`[${contact.email}] ❌ Database update error:`, updateError);
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`[${contact.email}] ✅ SUCCESS - Composite generated and saved`);
        successCount++;

      } catch (error: any) {
        console.error(`[${contact.email}] ❌ FAILED:`, {
          error: error.message,
          stack: error.stack,
          logoUrl: contact.logo_url,
          company: contact.company
        });
        failCount++;
        const errorDetails = `${error.message}${error.cause ? ` (${error.cause})` : ''}`;
        errors.push(`${contact.email} (${contact.company || 'No company'}): ${errorDetails}`);
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
