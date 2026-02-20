import { useEffect, useState } from 'react';
import { supabase, Post as PostType } from '../lib/supabase';
import { Post } from './Post';
import { Loader2 } from 'lucide-react';

type FeedProps = {
  onNavigateToProfile: (userId: string) => void;
};

export function Feed({ onNavigateToProfile }: FeedProps) {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey(*),
          likes(*),
          comments(*, profiles(*))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No posts yet. Be the first to share something!</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {posts.map((post) => (
        <Post key={post.id} post={post} onUpdate={loadPosts} onNavigateToProfile={onNavigateToProfile} />
      ))}
    </div>
  );
}
