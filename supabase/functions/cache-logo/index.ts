import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logoUrl, contactId } = await req.json();
    console.log(`[cache-logo] Caching logo for contact: ${contactId}`);
    console.log(`[cache-logo] Original URL: ${logoUrl}`);

    // Check if already cached (from our storage)
    if (logoUrl.includes('supabase.co/storage/v1/object/public/logos/')) {
      console.log(`[cache-logo] Already cached, returning original URL`);
      return new Response(
        JSON.stringify({ cachedUrl: logoUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch logo from external URL
    const logoResponse = await fetch(logoUrl);
    if (!logoResponse.ok) {
      throw new Error(`Failed to fetch logo: ${logoResponse.status}`);
    }

    const logoBlob = await logoResponse.blob();
    const arrayBuffer = await logoBlob.arrayBuffer();
    console.log(`[cache-logo] Downloaded: ${arrayBuffer.byteLength} bytes`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine content type
    const contentType = logoResponse.headers.get('content-type') || 'image/png';
    const extension = contentType.includes('svg') ? 'svg' :
                     contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
                     contentType.includes('png') ? 'png' : 'png';

    // Upload to storage
    const fileName = `cached/${contactId}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, new Uint8Array(arrayBuffer), {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName);

    console.log(`[cache-logo] Cached to: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({ cachedUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[cache-logo] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
