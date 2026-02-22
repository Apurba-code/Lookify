import { useState, useEffect } from 'react';
import { supabase, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import { PostDetailModal } from './PostDetailModal';

type NotificationsProps = {
    onNavigateToProfile: (userId: string) => void;
    onBack: () => void;
};

export function Notifications({ onNavigateToProfile, onBack }: NotificationsProps) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<(Notification & { sender: any, post?: any })[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (user) {
            loadNotifications();
            markAllAsRead();
            loadFollowing();
        }
    }, [user]);

    async function loadFollowing() {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);
            if (data) {
                setFollowingIds(new Set(data.map(f => f.following_id)));
            }
        } catch (error) {
            console.error('Error loading following status:', error);
        }
    }

    async function loadNotifications() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*, sender:sender_id(id, username, avatar_url, full_name), post:post_id(id, image_url)')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    }

    async function markAllAsRead() {
        if (!user) return;
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('refreshUnreadCounts'));
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
    }

    async function handleDeleteNotification(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }

    function handleNotificationClick(notif: any) {
        if (notif.type === 'follow') {
            onNavigateToProfile(notif.sender_id);
        } else if ((notif.type === 'like' || notif.type === 'comment') && notif.post_id) {
            setSelectedPostId(notif.post_id);
        }
    }

    async function handleFollowBack(e: React.MouseEvent, senderId: string) {
        e.stopPropagation();
        if (!user || followingIds.has(senderId) || senderId === user.id) return;

        // Optimistic UI
        setFollowingIds(prev => new Set([...Array.from(prev), senderId]));

        try {
            const { error } = await supabase
                .from('follows')
                .insert({ follower_id: user.id, following_id: senderId });

            if (error) throw error;

            // Send follow notification back
            await supabase.from('notifications').insert({
                user_id: senderId,
                sender_id: user.id,
                type: 'follow'
            });
        } catch (error: any) {
            if (error.code !== '23505') { // Ignore duplicate follow errors
                console.error('Error following back:', error);
                // Rollback on error
                setFollowingIds(prev => {
                    const next = new Set(prev);
                    next.delete(senderId);
                    return next;
                });
            }
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 min-h-screen">
            <div className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4 z-10 transition-colors">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold dark:text-white">Notifications</h2>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {notifications.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No notifications yet</p>
                    </div>
                ) : (
                    notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`group p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateToProfile(notif.sender.id);
                                }}
                                className="flex-shrink-0"
                            >
                                {notif.sender.avatar_url ? (
                                    <img src={notif.sender.avatar_url} alt={notif.sender.username} className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                        {notif.sender.username[0].toUpperCase()}
                                    </div>
                                )}
                            </button>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm dark:text-gray-200 leading-relaxed">
                                    <span
                                        className="font-bold hover:underline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigateToProfile(notif.sender.id);
                                        }}
                                    >
                                        {notif.sender.username}
                                    </span>
                                    {' '}
                                    <span className="text-gray-600 dark:text-gray-400">
                                        {notif.type === 'like' && 'liked your post'}
                                        {notif.type === 'comment' && 'commented on your post'}
                                        {notif.type === 'follow' && 'started following you'}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">
                                        {new Date(notif.created_at).toLocaleDateString()}
                                    </span>
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {notif.type === 'follow' && (
                                    <button
                                        onClick={(e) => handleFollowBack(e, notif.sender.id)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${followingIds.has(notif.sender.id)
                                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-default'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                    >
                                        {followingIds.has(notif.sender.id) ? 'Following' : 'Follow Back'}
                                    </button>
                                )}

                                {(notif.type === 'like' || notif.type === 'comment') && notif.post?.image_url && (
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                                        <img src={notif.post.image_url} alt="Post preview" className="w-full h-full object-cover" />
                                    </div>
                                )}

                                <button
                                    onClick={(e) => handleDeleteNotification(e, notif.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    title="Delete notification"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedPostId && (
                <PostDetailModal
                    postId={selectedPostId}
                    onClose={() => setSelectedPostId(null)}
                    onNavigateToProfile={onNavigateToProfile}
                />
            )}
        </div>
    );
}
