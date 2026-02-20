-- Create saved_posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

-- Policies for Row Level Security
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'saved_posts' AND policyname = 'Users can view their own saved posts'
    ) THEN
        CREATE POLICY "Users can view their own saved posts"
            ON public.saved_posts FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'saved_posts' AND policyname = 'Users can save posts'
    ) THEN
        CREATE POLICY "Users can save posts"
            ON public.saved_posts FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'saved_posts' AND policyname = 'Users can unsave their own posts'
    ) THEN
        CREATE POLICY "Users can unsave their own posts"
            ON public.saved_posts FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;
