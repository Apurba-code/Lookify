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
  last_seen?: string;
  cover_url?: string | null;
};

export type Post = {
  id: string;
  user_id: string;
  image_url: string;
  media?: { url: string; type: 'image' | 'video' }[];
  caption: string;
  location: string | null;
  hide_likes: boolean;
  allow_comments: boolean;
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

export type SavedPost = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  sender_id: string;
  type: 'like' | 'comment' | 'follow';
  post_id?: string;
  is_read: boolean;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
  updated_at?: string;
  created_at: string;
};
