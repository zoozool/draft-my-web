import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaignId, csvContent } = await req.json();

    if (!campaignId || !csvContent) {
      throw new Error("Missing campaignId or csvContent");
    }

    console.log("Processing CSV for campaign:", campaignId);

    // Parse CSV content
    const lines = csvContent.split("\n").filter((line: string) => line.trim());
    
    // Auto-detect delimiter (comma or semicolon)
    const delimiter = lines[0].includes(";") ? ";" : ",";
    console.log("Detected delimiter:", delimiter);
    
    const firstLine = lines[0].split(delimiter).map((h: string) => h.trim().toLowerCase());
    
    // Check if first line contains headers or data (by looking for email pattern)
    const hasHeaders = firstLine.some((cell: string) => 
      cell === "email" || cell === "company" || cell === "contact" || cell === "logourl" || cell === "logo_url" || cell === "title"
    );
    
    let emailIndex, firstNameIndex, lastNameIndex, companyIndex, logoUrlIndex;
    let startIndex;
    
    if (hasHeaders) {
      // Parse with headers
      emailIndex = firstLine.findIndex((h: string) => h === "email");
      firstNameIndex = firstLine.findIndex((h: string) => 
        h === "first_name" || h === "firstname" || h === "contact" || h === "name"
      );
      lastNameIndex = firstLine.findIndex((h: string) => h === "last_name" || h === "lastname");
      companyIndex = firstLine.findIndex((h: string) => h === "company" || h === "title");
      logoUrlIndex = firstLine.findIndex((h: string) => h === "logourl" || h === "logo_url" || h === "logo");
      startIndex = 1; // Skip header row
      
      if (emailIndex === -1) {
        throw new Error("CSV must contain an 'email' column");
      }
    } else {
      // No headers - assume positional format: Company, Email, Contact, LogoURL
      companyIndex = 0;
      emailIndex = 1;
      firstNameIndex = 2;
      logoUrlIndex = 3;
      lastNameIndex = -1;
      startIndex = 0; // Start from first line
      
      console.log("No headers detected, using positional format: Company, Email, Contact, LogoURL");
    }

    const contacts = [];
    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v: string) => v.trim());
      const email = values[emailIndex];
      
      if (email && email.includes("@")) {
        contacts.push({
          campaign_id: campaignId,
          email,
          first_name: firstNameIndex >= 0 ? values[firstNameIndex] : null,
          last_name: lastNameIndex >= 0 ? values[lastNameIndex] : null,
          company: companyIndex >= 0 ? values[companyIndex] : null,
          logo_url: logoUrlIndex >= 0 ? values[logoUrlIndex] : null,
          status: "pending",
        });
      }
    }

    console.log(`Parsed ${contacts.length} contacts`);

    // Insert contacts in batches
    const { error: insertError } = await supabase
      .from("contacts")
      .insert(contacts);

    if (insertError) throw insertError;

    // Update campaign counts
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        total_contacts: contacts.length,
        pending_count: contacts.length,
      })
      .eq("id", campaignId);

    if (updateError) throw updateError;

    console.log("Successfully processed CSV");

    return new Response(
      JSON.stringify({
        success: true,
        contactsCreated: contacts.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing CSV:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
