import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

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
    
    // Return mock data for now - in production you'd query actual Supabase analytics
    const mockLogs = {
      edge: [
        {
          id: "1",
          timestamp: Date.now() * 1000,
          level: "error",
          event_message: "Edge function execution failed",
          function_id: "generate-composite-images"
        },
        {
          id: "2",
          timestamp: Date.now() * 1000,
          level: "warning",
          event_message: "Slow edge function response",
          function_id: "send-emails"
        }
      ],
      auth: [
        {
          id: "1",
          timestamp: Date.now() * 1000,
          level: "error",
          msg: "Authentication failed",
          event_message: "Invalid credentials"
        }
      ],
      db: [
        {
          id: "1",
          timestamp: Date.now() * 1000,
          error_severity: "ERROR",
          event_message: "Database connection timeout"
        }
      ]
    };

    const logs = mockLogs[logType as keyof typeof mockLogs] || [];

    return new Response(
      JSON.stringify({ logs }),
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
