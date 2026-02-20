import React from "react";
import { useState, useEffect } from 'react';
import { X, Heart, MessageCircle } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type PostDetail = {
    id: string;
    user_id: string;
    image_url: string;
    caption: string;
    created_at: string;
    profiles: Profile;
};

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

            // Load likes with profiles
            const { data: likesData } = await supabase
                .from('likes')
                .select('*, profiles(*)')
                .eq('post_id', postId)
                .order('created_at', { ascending: false });

            setLikes(likesData || []);

            // Load comments with profiles
            const { data: commentsData } = await supabase
                .from('comments')
                .select('*, profiles(*)')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            setComments(commentsData || []);

            // Check if current user liked
            if (user) {
                setIsLiked(likesData?.some(l => l.user_id === user.id) || false);
            }
        } catch (error) {
            console.error('Error loading post details:', error);
        } finally {
            setLoading(false);
        }
    }

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
                setLikes(prev => prev.filter(l => l.user_id !== user.id));
            } else {
                const { data } = await supabase
                    .from('likes')
                    .insert({ post_id: postId, user_id: user.id })
                    .select('*, profiles(*)')
                    .single();
                setIsLiked(true);
                if (data) setLikes(prev => [data, ...prev]);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }

    async function handleComment(e: React.FormEvent) {
        e.preventDefault();
        if (!user || !comment.trim() || submitting) return;

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
            if (data) setComments(prev => [...prev, data]);
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
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
            >
                <X className="w-8 h-8" />
            </button>

            <div
                className="bg-white rounded-xl max-w-6xl w-full h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {loading ? (
                    <div className="flex items-center justify-center w-full py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    </div>
                ) : post ? (
                    <>
                        {/* Left: Post Image */}
                        <div className="md:w-[60%] bg-black flex items-center justify-center h-[40vh] md:h-full">
                            <img
                                src={post.image_url}
                                alt="Post"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        {/* Right: Details */}
                        <div className="md:w-[40%] flex flex-col h-[50vh] md:h-full">
                            {/* Header */}
                            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
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
                                    <button
                                        onClick={() => { onClose(); onNavigateToProfile(post.profiles.id); }}
                                        className="font-semibold text-sm hover:text-blue-600 transition-colors"
                                    >
                                        {post.profiles.username}
                                    </button>
                                    {post.profiles.full_name && (
                                        <p className="text-xs text-gray-500">{post.profiles.full_name}</p>
                                    )}
                                </div>
                            </div>

                            {/* Comments / Likes section - scrollable */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Caption */}
                                {post.caption && (
                                    <div className="flex gap-3">
                                        <button onClick={() => { onClose(); onNavigateToProfile(post.profiles.id); }}>
                                            {post.profiles.avatar_url ? (
                                                <img src={post.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                                    {post.profiles.username[0].toUpperCase()}
                                                </div>
                                            )}
                                        </button>
                                        <div>
                                            <p className="text-sm">
                                                <span className="font-semibold mr-2">{post.profiles.username}</span>
                                                {post.caption}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">{timeAgo(post.created_at)}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Likes summary */}
                                {likes.length > 0 && (
                                    <div className="py-2 border-y border-gray-100">
                                        <p className="text-sm font-semibold text-gray-700 mb-2">
                                            ❤️ {likes.length} {likes.length === 1 ? 'like' : 'likes'}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {likes.slice(0, 8).map((like) => (
                                                <button
                                                    key={like.id}
                                                    onClick={() => { onClose(); onNavigateToProfile(like.user_id); }}
                                                    className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1 hover:bg-gray-100 transition-colors"
                                                >
                                                    {like.profiles?.avatar_url ? (
                                                        <img src={like.profiles.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-semibold">
                                                            {like.profiles?.username?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <span className="text-xs font-medium text-gray-700">{like.profiles?.username}</span>
                                                </button>
                                            ))}
                                            {likes.length > 8 && (
                                                <span className="text-xs text-gray-400 self-center">+{likes.length - 8} more</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Comments */}
                                {comments.length > 0 ? (
                                    <div className="space-y-4">
                                        {comments.map((c) => (
                                            <div key={c.id} className="flex gap-3">
                                                <button onClick={() => { onClose(); onNavigateToProfile(c.user_id); }} className="flex-shrink-0">
                                                    {c.profiles?.avatar_url ? (
                                                        <img src={c.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                                            {c.profiles?.username?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                </button>
                                                <div className="flex-1">
                                                    <p className="text-sm">
                                                        <button
                                                            onClick={() => { onClose(); onNavigateToProfile(c.user_id); }}
                                                            className="font-semibold mr-2 hover:text-blue-600 transition-colors"
                                                        >
                                                            {c.profiles?.username}
                                                        </button>
                                                        {c.content}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">{timeAgo(c.created_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No comments yet</p>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="border-t border-gray-200 p-4">
                                <div className="flex items-center gap-4 mb-3">
                                    <button
                                        onClick={handleLike}
                                        className="hover:text-gray-500 transition-colors"
                                    >
                                        <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-600 text-red-600' : ''}`} />
                                    </button>
                                    <label htmlFor="modal-comment-input" className="cursor-pointer hover:text-gray-500 transition-colors">
                                        <MessageCircle className="w-6 h-6" />
                                    </label>
                                </div>
                                <p className="font-semibold text-sm mb-2">{likes.length} {likes.length === 1 ? 'like' : 'likes'}</p>

                                <form onSubmit={handleComment} className="flex gap-2 items-center">
                                    <input
                                        id="modal-comment-input"
                                        type="text"
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Add a comment..."
                                        className="flex-1 text-sm focus:outline-none border-none bg-transparent"
                                    />
                                    {comment.trim() && (
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="text-blue-600 font-semibold text-sm hover:text-blue-800 disabled:opacity-50"
                                        >
                                            {submitting ? '...' : 'Post'}
                                        </button>
                                    )}
                                </form>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center w-full py-24 text-gray-500">
                        Post not found
                    </div>
                )}
            </div>
        </div>
    );
}
