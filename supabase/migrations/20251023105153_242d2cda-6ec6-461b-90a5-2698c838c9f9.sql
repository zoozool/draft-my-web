-- Fix security issue: Set proper search_path for the function

CREATE OR REPLACE FUNCTION public.trigger_composite_generation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  campaign RECORD;
  supabase_url TEXT;
  anon_key TEXT;
BEGIN
  -- Get Supabase URL and anon key from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- Loop through all active campaigns that have contacts needing composite generation
  FOR campaign IN 
    SELECT DISTINCT c.campaign_id
    FROM contacts c
    WHERE c.logo_url IS NOT NULL 
    AND c.composite_image_url IS NULL
    LIMIT 10 -- Process up to 10 campaigns per cron run
  LOOP
    -- Call the edge function for each campaign (generates 5 images per campaign)
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/generate-composite-images',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object(
        'campaignId', campaign.campaign_id,
        'limit', 5
      )
    );
  END LOOP;
END;
$$;