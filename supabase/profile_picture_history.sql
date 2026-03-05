-- Create table for profile picture history
CREATE TABLE IF NOT EXISTS public.profile_pictures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profile_pictures ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Profile pictures are viewable by everyone"
    ON public.profile_pictures FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile pictures"
    ON public.profile_pictures FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile pictures"
    ON public.profile_pictures FOR DELETE
    USING (auth.uid() = user_id);

-- Migration: Insert current profile pictures into history
INSERT INTO public.profile_pictures (user_id, url)
SELECT id, avatar_url FROM public.profiles WHERE avatar_url IS NOT NULL;
