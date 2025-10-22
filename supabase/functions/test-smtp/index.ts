import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Testing SMTP connection to ${body.smtp_host}:${body.smtp_port}`);

    // Test SMTP connection using raw TCP/TLS
    try {
      const conn = await Deno.connect({
        hostname: body.smtp_host,
        port: body.smtp_port,
      });

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Read initial greeting
      const buffer = new Uint8Array(1024);
      await conn.read(buffer);
      const greeting = decoder.decode(buffer);
      console.log("Server greeting:", greeting.substring(0, 100));

      if (!greeting.startsWith("220")) {
        throw new Error("Invalid SMTP greeting");
      }

      // Send EHLO
      await conn.write(encoder.encode("EHLO test.local\r\n"));
      await conn.read(buffer);
      const ehloResponse = decoder.decode(buffer);
      console.log("EHLO response:", ehloResponse.substring(0, 100));

      if (body.use_tls && body.smtp_port !== 465) {
        // Send STARTTLS
        await conn.write(encoder.encode("STARTTLS\r\n"));
        await conn.read(buffer);
        const starttlsResponse = decoder.decode(buffer);
        console.log("STARTTLS response:", starttlsResponse.substring(0, 100));

        if (!starttlsResponse.startsWith("220")) {
          throw new Error("STARTTLS failed");
        }

        // Upgrade to TLS
        const tlsConn = await Deno.startTls(conn, { hostname: body.smtp_host });
        
        // Send EHLO again after TLS
        await tlsConn.write(encoder.encode("EHLO test.local\r\n"));
        await tlsConn.read(buffer);

        // Send AUTH LOGIN
        await tlsConn.write(encoder.encode("AUTH LOGIN\r\n"));
        await tlsConn.read(buffer);

        // Send username (base64)
        const username = btoa(body.smtp_username);
        await tlsConn.write(encoder.encode(`${username}\r\n`));
        await tlsConn.read(buffer);

        // Send password (base64)
        const password = btoa(body.smtp_password);
        await tlsConn.write(encoder.encode(`${password}\r\n`));
        await tlsConn.read(buffer);
        const authResponse = decoder.decode(buffer);
        console.log("Auth response:", authResponse.substring(0, 100));

        if (!authResponse.startsWith("235")) {
          throw new Error("Authentication failed: " + authResponse.substring(0, 50));
        }

        // Send QUIT
        await tlsConn.write(encoder.encode("QUIT\r\n"));
        tlsConn.close();
      } else {
        // Send QUIT for non-TLS or implicit TLS (port 465)
        await conn.write(encoder.encode("QUIT\r\n"));
        conn.close();
      }

      console.log("✅ SMTP connection test successful");
      
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
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
