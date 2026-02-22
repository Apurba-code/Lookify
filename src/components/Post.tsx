import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Trash2, Edit3 } from 'lucide-react';
import { supabase, Post as PostType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PostDetailModal } from './PostDetailModal';
import { Modal } from './Modal';
import { ShareModal } from './ShareModal';

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
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  async function handleDelete() {
    setShowDeleteModal(false);
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
      checkSaveStatus();
    }
  }, [post.id, user]);

  async function checkSaveStatus() {
    if (!user) return;
    const { data } = await supabase
      .from('saved_posts')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', user.id)
      .maybeSingle();
    setIsSaved(!!data);
  }

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

  async function handleSave() {
    if (!user) return;

    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        if (error) throw error;
        setIsSaved(false);
      } else {
        const { error } = await supabase
          .from('saved_posts')
          .insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
        setIsSaved(true);
      }
    } catch (error: any) {
      console.error('Error toggling save:', error);
      alert(error.message || 'Failed to save post');
      checkSaveStatus();
    }
  }

  async function createNotification(type: 'like' | 'comment' | 'follow', targetUserId: string) {
    if (!user || user.id === targetUserId) return;

    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          sender_id: user.id,
          type,
          post_id: (type === 'like' || type === 'comment') ? post.id : null
        });
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
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
        // Trigger notification
        await createNotification('like', post.user_id);
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

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ caption: editCaption.trim() })
        .eq('id', post.id);

      if (error) throw error;
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post');
    } finally {
      setIsSubmittingEdit(false);
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
      <article className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg mb-6 transition-colors">
        <div className="flex items-center justify-between p-4 relative">
          <button onClick={() => post.profiles?.id && onNavigateToProfile(post.profiles.id)} className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left">
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
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm dark:text-white">{post.profiles.username}</p>
              <span className="text-gray-400 dark:text-gray-500 text-sm">•</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">{timeAgo(post.created_at)}</p>
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
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-20">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditCaption(post.caption || '');
                      setShowDeleteMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Post
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(true);
                      setShowDeleteMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full relative cursor-pointer" onClick={() => setShowDetailModal(true)}>
          {post.image_url.match(/\.(mp4|mov|webm)$/i) ? (
            <video
              src={post.image_url}
              className="w-full h-auto max-h-[700px] object-contain"
              controls
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={post.image_url}
              alt="Post"
              className="w-full h-auto max-h-[700px] object-contain"
            />
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 dark:text-white">
              <button
                onClick={handleLike}
                className="hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                <Heart
                  className={`w-6 h-6 ${isLiked ? 'fill-red-600 text-red-600' : ''}`}
                />
              </button>
              <button
                onClick={() => setShowComments(!showComments)}
                className="hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                <Send className="w-6 h-6" />
              </button>
            </div>
            {user?.id !== post.user_id && (
              <button
                onClick={handleSave}
                className="hover:text-gray-500 dark:hover:text-gray-400 transition-colors dark:text-white"
              >
                <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-black text-black dark:fill-white dark:text-white' : ''}`} />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 space-y-2">
          {likesCount > 0 && (
            <p className="font-semibold text-sm dark:text-white">
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
            </p>
          )}

          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="space-y-2">
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent dark:text-white resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : post.caption && (
            <p className="text-sm dark:text-gray-100">
              <button
                onClick={() => post.profiles?.id && onNavigateToProfile(post.profiles.id)}
                className="font-semibold mr-2 hover:text-blue-600 transition-colors dark:text-white"
              >
                {post.profiles?.username}
              </button>
              {post.caption}
            </p>
          )}

          {post.comments && post.comments.length > 0 && (
            <div className="space-y-1">
              {!showComments && post.comments.length > 2 && (
                <button
                  onClick={() => setShowComments(true)}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  View all {post.comments.length} comments
                </button>
              )}
              <div className={`space-y-1 ${!showComments ? 'max-h-20 overflow-hidden' : ''}`}>
                {post.comments.map((comment) => (
                  <p key={comment.id} className="text-sm dark:text-gray-200">
                    <button
                      onClick={() => comment.profiles?.id && onNavigateToProfile(comment.profiles.id)}
                      className="font-semibold mr-2 hover:text-blue-600 transition-colors dark:text-white"
                    >
                      {comment.profiles?.username}
                    </button>
                    {comment.content}
                  </p>
                ))}
              </div>
            </div>
          )}


        </div>

        <form onSubmit={handleComment} className="mt-4 p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 text-sm focus:outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
          />
          {comment.trim() && (
            <button
              type="submit"
              className="text-blue-600 font-semibold text-sm hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Post
            </button>
          )}
        </form>
      </article>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Post?"
      >
        <div className="space-y-4 text-center">
          <p className="text-gray-600">Are you sure you want to delete this post? This action cannot be undone.</p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {showDetailModal && (
        <PostDetailModal
          postId={post.id}
          onClose={() => setShowDetailModal(false)}
          onNavigateToProfile={onNavigateToProfile}
        />
      )}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        postUrl={`${window.location.origin}/post/${post.id}`}
      />
    </>
  );
}
