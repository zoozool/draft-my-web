-- Add column to store generated composite image URL
ALTER TABLE public.contacts 
ADD COLUMN composite_image_url TEXT;