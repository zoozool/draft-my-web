-- Add search API key to smtp_settings table
ALTER TABLE smtp_settings 
ADD COLUMN IF NOT EXISTS search_api_key TEXT;