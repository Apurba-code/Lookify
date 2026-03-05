-- Add media and edit support to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

-- Add policies for editing and deleting
CREATE POLICY "Users can edit their own messages"
    ON public.messages FOR UPDATE
    USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
    ON public.messages FOR DELETE
    USING (auth.uid() = sender_id);
-- Create storage bucket for message media if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for message-media
CREATE POLICY "Allow authenticated uploads to message-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-media');

CREATE POLICY "Allow public read from message-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-media');

CREATE POLICY "Allow users to delete their own message media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-media' AND (auth.uid()::text = (storage.foldername(name))[1]));
