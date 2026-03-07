import { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Send, ChevronDown, Smile } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShareModal } from './ShareModal';

type PostDetail = {
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
};

// ... (LikeDetail and CommentDetail types remain same)

type LikeDetail = {
    id: string;
    user_id: string;
    created_at: string;
    profiles: Profile;
};

type CommentDetail = {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles: Profile;
};

type PostDetailModalProps = {
    postId: string;
    onClose: () => void;
    onNavigateToProfile: (userId: string) => void;
};

export function PostDetailModal({ postId, onClose, onNavigateToProfile }: PostDetailModalProps) {
    const { user } = useAuth();
    const [post, setPost] = useState<PostDetail | null>(null);
    const [likes, setLikes] = useState<LikeDetail[]>([]);
    const [comments, setComments] = useState<CommentDetail[]>([]);
    const [isLiked, setIsLiked] = useState(false);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        loadPostDetails();
    }, [postId]);

    async function loadPostDetails() {
        setLoading(true);
        try {
            // Load post
            const { data: postData } = await supabase
                .from('posts')
                .select('*, profiles!posts_user_id_fkey(*)')
                .eq('id', postId)
                .single();

            if (postData) setPost(postData);

            // ... (likes and comments loading remains same)

            // Load likes with profiles
            const { data: likesData } = await supabase
                .from('likes')
                .select('*, profiles(*)')
                .eq('post_id', postId)
                .order('created_at', { ascending: false });

            setLikes((likesData as LikeDetail[]) || []);

            // Load comments with profiles
            const { data: commentsData } = await supabase
                .from('comments')
                .select('*, profiles(*)')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            setComments((commentsData as CommentDetail[]) || []);

            // Check if current user liked
            if (user) {
                setIsLiked(likesData?.some((l: any) => l.user_id === user.id) || false);
            }
        } catch (error) {
            console.error('Error loading post details:', error);
        } finally {
            setLoading(false);
        }
    }

    const nextMedia = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (post?.media) {
            setCurrentMediaIndex((prev: number) => (prev + 1) % post.media!.length);
        }
    };

    const prevMedia = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (post?.media) {
            setCurrentMediaIndex((prev: number) => (prev - 1 + post.media!.length) % post.media!.length);
        }
    };

    // ... (handleLike, handleComment, timeAgo methods remain same)

    async function handleLike() {
        if (!user) return;

        try {
            if (isLiked) {
                await supabase
                    .from('likes')
                    .delete()
                    .eq('post_id', postId)
                    .eq('user_id', user.id);
                setIsLiked(false);
                setLikes((prev: LikeDetail[]) => prev.filter((l: LikeDetail) => l.user_id !== user.id));
            } else {
                const { data } = await supabase
                    .from('likes')
                    .insert({ post_id: postId, user_id: user.id })
                    .select('*, profiles(*)')
                    .single();
                setIsLiked(true);
                if (data) setLikes((prev: LikeDetail[]) => [data as LikeDetail, ...prev]);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }

    async function handleComment(e: React.FormEvent) {
        e.preventDefault();
        if (!user || !comment.trim() || submitting || post?.allow_comments === false) return;

        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    content: comment.trim(),
                })
                .select('*, profiles(*)')
                .single();

            if (error) throw error;
            if (data) setComments((prev: CommentDetail[]) => [...prev, data as CommentDetail]);
            setComment('');
        } catch (error) {
            console.error('Error posting comment:', error);
        } finally {
            setSubmitting(false);
        }
    }

    const timeAgo = (date: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(date).toLocaleDateString();
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 transition-colors"
            >
                <X className="w-8 h-8" />
            </button>

            <div
                className="bg-white dark:bg-[#121212] rounded-xl max-w-6xl w-full h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {loading ? (
                    <div className="flex items-center justify-center w-full py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    </div>
                ) : post ? (
                    <>
                        {/* Left: Post Media Carousel */}
                        <div className="md:w-[60%] bg-black flex items-center justify-center min-h-[40vh] md:h-full relative overflow-hidden">
                            {(() => {
                                const media = post.media || [{ url: post.image_url, type: post.image_url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image' }];

                                return (
                                    <>
                                        <div className="w-full h-full flex items-center justify-center">
                                            {media[currentMediaIndex].type === 'video' ? (
                                                <video
                                                    key={media[currentMediaIndex].url}
                                                    src={media[currentMediaIndex].url}
                                                    className="max-w-full max-h-full w-auto h-auto object-contain"
                                                    controls
                                                    autoPlay
                                                    muted
                                                />
                                            ) : (
                                                <img
                                                    src={media[currentMediaIndex].url}
                                                    alt="Post media"
                                                    className="max-w-full max-h-full w-auto h-auto object-contain"
                                                />
                                            )}
                                        </div>

                                        {media.length > 1 && (
                                            <>
                                                <button
                                                    onClick={prevMedia}
                                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white backdrop-blur-sm transition-all z-10"
                                                >
                                                    <ChevronDown className="w-6 h-6 rotate-90" />
                                                </button>
                                                <button
                                                    onClick={nextMedia}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white backdrop-blur-sm transition-all z-10"
                                                >
                                                    <ChevronDown className="w-6 h-6 -rotate-90" />
                                                </button>

                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                                    {media.map((_, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`w-1.5 h-1.5 rounded-full transition-all ${currentMediaIndex === idx ? 'bg-white scale-125' : 'bg-white/40'}`}
                                                        />
                                                    ))}
                                                </div>

                                                <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full font-medium backdrop-blur-sm z-10">
                                                    {currentMediaIndex + 1}/{media.length}
                                                </div>
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Right: Details */}
                        <div className="md:w-[40%] flex flex-col h-[50vh] md:h-full border-l border-gray-100 dark:border-zinc-800">
                            {/* Header */}
                            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-zinc-800">
                                <button onClick={() => { onClose(); onNavigateToProfile(post.profiles.id); }}>
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
                                </button>
                                <div className="flex-1">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <button
                                                onClick={() => { onClose(); onNavigateToProfile(post.profiles.id); }}
                                                className="font-bold text-sm hover:text-blue-600 transition-colors dark:text-white"
                                            >
                                                {post.profiles.username}
                                            </button>
                                            {post.location && (
                                                <p className="text-sm text-gray-500 dark:text-zinc-500">
                                                    in <span className="font-medium text-gray-900 dark:text-white underline decoration-zinc-700 underline-offset-2">{post.location}</span>
                                                </p>
                                            )}
                                            <span className="text-gray-400 dark:text-zinc-700 text-sm">•</span>
                                            <p className="text-sm text-gray-500 dark:text-zinc-500">{timeAgo(post.created_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Comments / Likes section - scrollable */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
                                {/* Caption */}
                                {post.caption && (
                                    <div className="flex gap-3">
                                        <button onClick={() => { onClose(); onNavigateToProfile(post.profiles.id); }} className="flex-shrink-0">
                                            {post.profiles.avatar_url ? (
                                                <img src={post.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                                    {post.profiles.username[0].toUpperCase()}
                                                </div>
                                            )}
                                        </button>
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="text-sm dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                                                <span className="font-bold mr-2 dark:text-white hover:text-blue-600 transition-colors cursor-pointer inline-block" onClick={() => { onClose(); onNavigateToProfile(post.profiles.id); }}>
                                                    {post.profiles.username}
                                                </span>
                                                {post.caption}
                                            </div>
                                            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">{timeAgo(post.created_at)}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Likes summary section (hidden if requested) */}
                                {(!post.hide_likes || user?.id === post.user_id) && likes.length > 0 && (
                                    <div className="py-4 border-y border-gray-50 dark:border-zinc-800/50">
                                        <p className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-3">
                                            Likes ({likes.length}) {post.hide_likes && <span className="lowercase font-normal italic">(private)</span>}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {likes.slice(0, 8).map((like) => (
                                                <button
                                                    key={like.id}
                                                    onClick={() => { onClose(); onNavigateToProfile(like.user_id); }}
                                                    className="group flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-900 rounded-full pr-3 py-1 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all border border-transparent dark:border-zinc-800"
                                                >
                                                    {like.profiles?.avatar_url ? (
                                                        <img src={like.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-white text-[10px] font-bold">
                                                            {like.profiles?.username?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300 group-hover:text-blue-500">{like.profiles?.username}</span>
                                                </button>
                                            ))}
                                            {likes.length > 8 && (
                                                <button className="text-xs text-gray-400 dark:text-zinc-600 hover:text-white self-center pl-1 font-medium">
                                                    +{likes.length - 8} others
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Comments List */}
                                {post.allow_comments !== false ? (
                                    <div className="space-y-6">
                                        {comments.length > 0 ? (
                                            comments.map((c) => (
                                                <div key={c.id} className="flex gap-3 group">
                                                    <button onClick={() => { onClose(); onNavigateToProfile(c.user_id); }} className="flex-shrink-0">
                                                        {c.profiles?.avatar_url ? (
                                                            <img src={c.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                                                {c.profiles?.username?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                        )}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                                                            <button
                                                                onClick={() => { onClose(); onNavigateToProfile(c.user_id); }}
                                                                className="font-bold mr-2 hover:text-blue-600 transition-colors dark:text-white inline-block"
                                                            >
                                                                {c.profiles?.username}
                                                            </button>
                                                            {c.content}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <p className="text-xs text-gray-400 dark:text-zinc-600">{timeAgo(c.created_at)}</p>
                                                            <button className="text-xs font-bold text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">Reply</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-12 text-gray-400 dark:text-zinc-700">
                                                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p className="text-sm font-medium">No comments yet</p>
                                                <p className="text-xs mt-1 opacity-70">Start the conversation</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800">
                                        <p className="text-sm text-zinc-500 italic">Comments have been turned off for this post.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="border-t border-gray-100 dark:border-zinc-800 p-4 bg-white dark:bg-black/20">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-5 dark:text-white">
                                        <button
                                            onClick={handleLike}
                                            className="hover:scale-110 active:scale-90 transition-transform"
                                        >
                                            <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-600 text-red-600' : 'dark:text-zinc-300'} `} />
                                        </button>
                                        {post.allow_comments !== false && (
                                            <label htmlFor="modal-comment-input" className="cursor-pointer hover:scale-110 active:scale-90 transition-transform">
                                                <MessageCircle className="w-6 h-6 dark:text-zinc-300" />
                                            </label>
                                        )}
                                        <button
                                            onClick={() => setShowShareModal(true)}
                                            className="hover:scale-110 active:scale-90 transition-transform"
                                        >
                                            <Send className="w-6 h-6 dark:text-zinc-300" />
                                        </button>
                                    </div>
                                </div>

                                {(!post.hide_likes || user?.id === post.user_id) && (
                                    <p className="font-bold text-sm mb-4 dark:text-white">
                                        {likes.length} {likes.length === 1 ? 'like' : 'likes'}
                                        {post.hide_likes && <span className="ml-2 font-normal text-xs text-zinc-500">(Private)</span>}
                                    </p>
                                )}

                                {post.allow_comments !== false ? (
                                    <form onSubmit={handleComment} className="flex gap-3 items-center">
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="p-1 transition-transform active:scale-95 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                            >
                                                <Smile className="w-5 h-5" />
                                            </button>

                                            {showEmojiPicker && (
                                                <div className="absolute bottom-full left-0 mb-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-3 shadow-2xl z-50 grid grid-cols-6 gap-2 animate-in fade-in zoom-in duration-200 min-w-[240px]">
                                                    {['❤️', '🙌', '🔥', '👏', '😢', '😍', '✨', '😂', '😮', '👍', '🙏', '❤️‍🔥', '🤩', '💯', '🤔', '😎', '🥳', '💡'].map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            onClick={() => {
                                                                setComment(prev => prev + emoji);
                                                                setShowEmojiPicker(false);
                                                            }}
                                                            className="text-2xl hover:scale-125 transition-transform p-1"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            id="modal-comment-input"
                                            type="text"
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder="Add a comment..."
                                            className="flex-1 text-sm focus:outline-none border-none bg-transparent dark:text-white dark:placeholder-zinc-600"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!comment.trim() || submitting}
                                            className="text-blue-500 font-bold text-sm hover:text-blue-400 disabled:opacity-0 transition-all px-2"
                                        >
                                            {submitting ? '...' : 'Post'}
                                        </button>
                                    </form>
                                ) : (
                                    <p className="text-xs text-center text-zinc-600 font-medium py-1">Commenting is disabled</p>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center w-full py-24 text-gray-500">
                        Post not found
                    </div>
                )}
            </div>

            {post && (
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    postUrl={`${window.location.origin}/post/${post.id}`}
                />
            )}
        </div>
    );
}
