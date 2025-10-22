-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the send-emails function to run every minute
SELECT cron.schedule(
  'send-emails-every-minute',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://wnmfjueqkrvfnlvfgcvn.supabase.co/functions/v1/send-emails',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubWZqdWVxa3J2Zm5sdmZnY3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NDMzMTEsImV4cCI6MjA3NjIxOTMxMX0.i3MUrWw6CYnxZNQddFuqcwXsqw_cUUOnpwayX2oOdtg"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);