-- Add cover_url to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Create storage bucket for covers if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-covers', 'profile-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile-covers
CREATE POLICY "Allow public read from profile-covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-covers');

CREATE POLICY "Allow authenticated uploads to profile-covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-covers');

CREATE POLICY "Allow users to update/delete their own covers"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
