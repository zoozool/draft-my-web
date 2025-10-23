-- Add composite_batch_size column to smtp_settings table
ALTER TABLE smtp_settings 
ADD COLUMN composite_batch_size integer NOT NULL DEFAULT 5
CHECK (composite_batch_size >= 5 AND composite_batch_size <= 100);