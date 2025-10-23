-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Add processing status to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'idle' CHECK (processing_status IN ('idle', 'processing_images', 'sending_emails', 'completed', 'error'));

-- Add last_processed_at timestamp
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP WITH TIME ZONE;

-- Update default batch size for better performance
ALTER TABLE public.smtp_settings 
ALTER COLUMN composite_batch_size SET DEFAULT 20;

-- Create function to process campaign pipeline automatically
CREATE OR REPLACE FUNCTION public.auto_process_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  campaign_record RECORD;
  supabase_url TEXT;
  anon_key TEXT;
BEGIN
  -- Get environment variables
  supabase_url := current_setting('app.settings.supabase_url', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- Find campaigns that need processing (have pending contacts with logos but no composites)
  FOR campaign_record IN 
    SELECT DISTINCT c.campaign_id
    FROM contacts c
    JOIN campaigns camp ON camp.id = c.campaign_id
    WHERE c.logo_url IS NOT NULL 
    AND c.composite_image_url IS NULL
    AND c.status = 'pending'
    AND camp.processing_status = 'idle'
    AND camp.status = 'active'
    LIMIT 5 -- Process 5 campaigns per cron run
  LOOP
    -- Update campaign status to prevent concurrent processing
    UPDATE campaigns 
    SET processing_status = 'processing_images',
        last_processed_at = now()
    WHERE id = campaign_record.campaign_id;
    
    -- Trigger the orchestrator function for this campaign
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-campaign-pipeline',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object(
        'campaignId', campaign_record.campaign_id
      )
    );
  END LOOP;
END;
$$;

-- Schedule cron job to run daily at 2 AM
SELECT cron.schedule(
  'auto-process-campaigns-daily',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT public.auto_process_campaigns();
  $$
);

-- Optional: Add a more frequent check every 4 hours for faster processing
SELECT cron.schedule(
  'auto-process-campaigns-frequent',
  '0 */4 * * *', -- Every 4 hours
  $$
  SELECT public.auto_process_campaigns();
  $$
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_campaigns_processing_status ON public.campaigns(processing_status, status);
CREATE INDEX IF NOT EXISTS idx_contacts_composite_generation ON public.contacts(campaign_id, logo_url, composite_image_url, status);