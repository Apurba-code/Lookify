import { useEffect, useState } from 'react';
import { supabase, Post as PostType } from '../lib/supabase';
import { Post } from './Post';
import { Stories } from './Stories';
import { Loader2, PlusSquare } from 'lucide-react';

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

  return (
    <div className="max-w-lg mx-auto px-0 sm:px-4 py-6">
      <Stories />

      {posts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 mb-6 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/20 transform -rotate-6">
            <PlusSquare className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No Posts Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-[280px] mb-8">
            The world is waiting for your view. Share your first photo or video!
          </p>
          <button
            onClick={() => window.location.href = '/create'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
          >
            Create Your First Post
          </button>
        </div>
      ) : (
        <div className="space-y-8 mt-6">
          {posts.map((post) => (
            <Post key={post.id} post={post} onUpdate={loadPosts} onNavigateToProfile={onNavigateToProfile} />
          ))}
        </div>
      )}
    </div>
  );
}
