-- Add email rate limit field to smtp_settings table
ALTER TABLE smtp_settings 
ADD COLUMN IF NOT EXISTS emails_per_hour_limit INTEGER DEFAULT 100;