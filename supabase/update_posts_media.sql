-- Run this in your Supabase SQL Editor to update the posts table for multiple media
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;

-- Optional: If you want to migrate existing image_url data to the new media column
-- UPDATE posts 
-- SET media = jsonb_build_array(jsonb_build_object('url', image_url, 'type', 'image'))
-- WHERE image_url IS NOT NULL AND (media IS NULL OR media = '[]'::jsonb);
