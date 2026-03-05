-- Add story_id to messages to support story replies
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL;
