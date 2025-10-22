import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestSmtpRequest {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  use_tls: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("test-smtp invoked at", new Date().toISOString());

    const body: TestSmtpRequest = await req.json();
    
    // Validate required fields
    if (!body.smtp_host || !body.smtp_port || !body.smtp_username || 
        !body.smtp_password || !body.smtp_from_email || !body.smtp_from_name) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required SMTP configuration fields" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Testing SMTP connection to ${body.smtp_host}:${body.smtp_port}`);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: body.smtp_host,
        port: body.smtp_port,
        tls: body.use_tls,
        auth: {
          username: body.smtp_username,
          password: body.smtp_password,
        },
      },
    });

    // Test connection by sending a test email to the from address
    try {
      await client.send({
        from: `${body.smtp_from_name} <${body.smtp_from_email}>`,
        to: body.smtp_from_email,
        subject: "SMTP Connection Test",
        content: "This is a test email to verify your SMTP configuration.",
        html: "<p>This is a test email to verify your SMTP configuration.</p>",
      });
      console.log("✅ SMTP connection successful");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMTP connection test successful" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } catch (smtpError: any) {
      console.error("❌ SMTP connection failed:", smtpError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `SMTP connection failed: ${smtpError.message}` 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in test-smtp function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Internal server error" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
