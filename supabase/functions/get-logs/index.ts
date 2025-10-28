import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logType } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch real logs from database
    const { data: logs, error: logsError } = await supabase
      .from("error_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("log_type", logType)
      .order("created_at", { ascending: false })
      .limit(100);

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch logs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format logs for frontend
    const formattedLogs = (logs || []).map((log) => ({
      id: log.id,
      timestamp: new Date(log.created_at).getTime() * 1000,
      level: log.level,
      event_message: log.error_message,
      msg: log.error_message,
      error_severity: log.level.toUpperCase(),
      function_id: log.function_name || "Unknown",
      message: log.error_message,
      details: log.error_details,
    }));

    return new Response(
      JSON.stringify({ logs: formattedLogs }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
