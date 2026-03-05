import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Trash2, Edit3, ChevronDown } from 'lucide-react';
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

  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const media = post.media || (post.image_url ? [{ url: post.image_url, type: post.image_url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image' }] : []);

  const nextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMediaIndex(prev => (prev + 1) % media.length);
  };

  const prevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMediaIndex(prev => (prev - 1 + media.length) % media.length);
  };

  return (
    <>
      <article className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg mb-6 transition-colors">
        {/* ... Header remains same ... */}
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
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm dark:text-white">{post.profiles.username}</p>
                {post.location && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    in <span className="font-medium text-gray-900 dark:text-white underline decoration-gray-400/30 underline-offset-2">{post.location}</span>
                  </p>
                )}
                <span className="text-gray-400 dark:text-gray-500 text-sm">•</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">{timeAgo(post.created_at)}</p>
              </div>
            </div>
          </button>
          {user?.id === post.user_id && (
            <div className="relative">
              <button
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 p-2"
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

        {/* Media Carousel */}
        <div
          className="w-full relative cursor-pointer bg-gray-50 dark:bg-zinc-900 border-y border-gray-100 dark:border-zinc-800/50 overflow-hidden"
          onClick={() => setShowDetailModal(true)}
          style={{ aspectRatio: aspectRatio ? `${aspectRatio}` : '1/1' }}
        >
          <div
            className="flex transition-transform duration-500 ease-out h-full"
            style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}
          >
            {media.map((item, idx) => (
              <div key={idx} className="w-full h-full flex-shrink-0 flex items-center justify-center relative overflow-hidden bg-black">
                {item.type === 'video' ? (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    controls={currentMediaIndex === idx}
                    muted
                    loop
                    playsInline
                    onLoadedMetadata={(e) => {
                      if (idx === 0 && !aspectRatio) {
                        const { videoWidth, videoHeight } = e.currentTarget;
                        setAspectRatio(videoWidth / videoHeight);
                      }
                    }}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={`Post media ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onLoad={(e) => {
                      if (idx === 0 && !aspectRatio) {
                        const { naturalWidth, naturalHeight } = e.currentTarget;
                        setAspectRatio(naturalWidth / naturalHeight);
                      }
                    }}
                  />
                )}

                {/* Fallback/Overlay for better contrast on dots */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
              </div>
            ))}
          </div>

          {/* Arrows */}
          {media.length > 1 && (
            <>
              {currentMediaIndex > 0 && (
                <button
                  onClick={prevMedia}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-black/50 p-1.5 rounded-full shadow hover:bg-white dark:hover:bg-black transition-all z-10"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}
              {currentMediaIndex < media.length - 1 && (
                <button
                  onClick={nextMedia}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-black/50 p-1.5 rounded-full shadow hover:bg-white dark:hover:bg-black transition-all z-10"
                >
                  <ChevronDown className="w-5 h-5 -rotate-90" />
                </button>
              )}
            </>
          )}

          {/* Dots Indicator */}
          {media.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {media.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${currentMediaIndex === idx ? 'bg-[#0095f6] scale-125' : 'bg-white/60'}`}
                />
              ))}
            </div>
          )}

          {/* Multiple Media Badge */}
          {media.length > 1 && (
            <div className="absolute top-4 right-4 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-sm z-10">
              {currentMediaIndex + 1}/{media.length}
            </div>
          )}
        </div>

        <div className="p-4 pb-2">
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
              {post.allow_comments !== false && (
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
                >
                  <MessageCircle className="w-6 h-6" />
                </button>
              )}
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
          {(!post.hide_likes || user?.id === post.user_id) && likesCount > 0 && (
            <p className="font-semibold text-sm dark:text-white">
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
              {post.hide_likes && <span className="ml-2 text-xs font-normal text-gray-500">(Only visible to you)</span>}
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

          {post.allow_comments !== false && post.comments && post.comments.length > 0 && (
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

        {post.allow_comments !== false ? (
          <form onSubmit={handleComment} className="mt-2 p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
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
        ) : (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 italic">Comments have been turned off for this post.</p>
          </div>
        )}
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
