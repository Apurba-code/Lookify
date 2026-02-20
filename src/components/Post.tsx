import React from "react";
import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Trash2 } from 'lucide-react';
import { supabase, Post as PostType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PostDetailModal } from './PostDetailModal';

type PostProps = {
  post: PostType;
  onUpdate: () => void;
  onNavigateToProfile: (userId: string) => void;
};

export function Post({ post, onUpdate, onNavigateToProfile }: PostProps) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      // Delete image from storage
      const imagePath = post.image_url.split('/').pop();
      if (imagePath) {
        await supabase.storage.from('posts').remove([`${user?.id}/${imagePath}`]);
      }

      // Delete post record
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;

      onUpdate();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  }

  const [likeLoading, setLikeLoading] = useState(false);

  // Check like status directly from DB
  useEffect(() => {
    if (user) {
      checkLikeStatus();
    }
  }, [post.id, user]);

  async function checkLikeStatus() {
    if (!user) return;
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', user.id)
      .maybeSingle();
    setIsLiked(!!data);
  }

  async function refreshLikeCount() {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    setLikesCount(count || 0);
  }

  async function handleLike() {
    if (!user || likeLoading) return;
    setLikeLoading(true);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        if (error) throw error;
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
      // Refresh the actual count from DB
      setTimeout(() => refreshLikeCount(), 300);
    } catch (error: any) {
      console.error('Error toggling like:', error);
      // Refresh state from DB on error
      await checkLikeStatus();
      await refreshLikeCount();
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !comment.trim()) return;

    await supabase.from('comments').insert({
      post_id: post.id,
      user_id: user.id,
      content: comment.trim(),
    });

    setComment('');
    onUpdate();
  }

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <>
      <article className="bg-white border border-gray-300 rounded-lg mb-6">
        <div className="flex items-center justify-between p-4 relative">
          <button onClick={() => onNavigateToProfile(post.profiles.id)} className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left">
            {post.profiles.avatar_url ? (
              <img
                src={post.profiles.avatar_url}
                alt={post.profiles.username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                {post.profiles.username[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-sm">{post.profiles.username}</p>
              <p className="text-xs text-gray-500">{post.profiles.full_name}</p>
            </div>
          </button>
          {user?.id === post.user_id && (
            <div className="relative">
              <button
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                className="text-gray-600 hover:text-gray-900 p-2"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showDeleteMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full bg-gray-100 relative overflow-hidden cursor-pointer" onClick={() => setShowDetailModal(true)}>
          <img
            src={post.image_url}
            alt="Post"
            className="w-full h-auto object-contain"
          />
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className="hover:text-gray-500 transition-colors"
              >
                <Heart
                  className={`w-6 h-6 ${isLiked ? 'fill-red-600 text-red-600' : ''}`}
                />
              </button>
              <button
                onClick={() => setShowComments(!showComments)}
                className="hover:text-gray-500 transition-colors"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
              <button className="hover:text-gray-500 transition-colors">
                <Send className="w-6 h-6" />
              </button>
            </div>
            <button className="hover:text-gray-500 transition-colors">
              <Bookmark className="w-6 h-6" />
            </button>
          </div>

          {likesCount > 0 && (
            <p className="font-semibold text-sm mb-2">{likesCount} {likesCount === 1 ? 'like' : 'likes'}</p>
          )}

          {post.caption && (
            <p className="text-sm mb-2">
              <button
                onClick={() => onNavigateToProfile(post.profiles.id)}
                className="font-semibold mr-2 hover:text-blue-600 transition-colors"
              >
                {post.profiles.username}
              </button>
              {post.caption}
            </p>
          )}

          {post.comments && post.comments.length > 0 && (
            <>
              {!showComments && post.comments.length > 2 && (
                <button
                  onClick={() => setShowComments(true)}
                  className="text-sm text-gray-500 mb-2 hover:text-gray-700"
                >
                  View all {post.comments.length} comments
                </button>
              )}
              <div className={`space-y-2 ${!showComments ? 'max-h-20 overflow-hidden' : ''}`}>
                {post.comments.map((comment) => (
                  <p key={comment.id} className="text-sm">
                    <button
                      onClick={() => onNavigateToProfile(comment.profiles.id)}
                      className="font-semibold mr-2 hover:text-blue-600 transition-colors"
                    >
                      {comment.profiles.username}
                    </button>
                    {comment.content}
                  </p>
                ))}
              </div>
            </>
          )}

          <p className="text-xs text-gray-500 mt-2 uppercase">{timeAgo(post.created_at)} ago</p>

          <form onSubmit={handleComment} className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 text-sm focus:outline-none"
            />
            {comment.trim() && (
              <button
                type="submit"
                className="text-blue-600 font-semibold text-sm hover:text-blue-800"
              >
                Post
              </button>
            )}
          </form>
        </div>
      </article>

      {
        showDetailModal && (
          <PostDetailModal
            postId={post.id}
            onClose={() => setShowDetailModal(false)}
            onNavigateToProfile={onNavigateToProfile}
          />
        )
      }
    </>
  );
}
