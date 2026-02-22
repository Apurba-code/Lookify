-- Run this in your Supabase SQL Editor to update the posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS hide_likes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true;
