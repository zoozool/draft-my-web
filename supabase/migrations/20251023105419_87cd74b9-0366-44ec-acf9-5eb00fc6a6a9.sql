-- Disable the automatic cron job for composite generation
SELECT cron.unschedule('generate-composite-images');

-- Keep the function available for manual triggering if needed
-- but it won't run automatically anymore