import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string;
  created_at: string;
  gender?: string;
  birth_date?: string;
  notification_settings?: {
    likes: boolean;
    comments: boolean;
    followers: boolean;
  };
};

export type Post = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  profiles: Profile;
  likes: Like[];
  comments: Comment[];
  _count?: {
    likes: number;
    comments: number;
  };
};

export type Like = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: Profile;
};

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};
