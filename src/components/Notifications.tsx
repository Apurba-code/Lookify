import React, { useEffect, useState } from 'react';
import { supabase, Notification, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Heart, MessageCircle, UserPlus, ArrowLeft, Loader2 } from 'lucide-react';

type NotificationsProps = {
    onNavigateToProfile: (userId: string) => void;
    onBack: () => void;
};

export function Notifications({ onNavigateToProfile, onBack }: NotificationsProps) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<(Notification & { sender: any })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadNotifications();
            markAllAsRead();
        }
    }, [user]);

    async function loadNotifications() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    *,
                    sender:sender_id (
                        id,
                        username,
                        avatar_url,
                        full_name
                    )
                `)
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
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
    }

    async function handleFollowBack(senderId: string) {
        if (!user) return;
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

            // Update local state to reflect follow back? 
            // For now, reload notifications or let the user see it's done via profile.
            alert('Followed back!');
        } catch (error: any) {
            if (error.code === '23505') {
                alert('Already following!');
            } else {
                console.error('Error following back:', error);
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
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4 z-10">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                    <ArrowLeft className="w-6 h-6 dark:text-white" />
                </button>
                <h2 className="text-xl font-bold dark:text-white">Notifications</h2>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {notifications.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No notifications yet</p>
                    </div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} className={`p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : ''}`}>
                            <button onClick={() => onNavigateToProfile(notif.sender.id)} className="flex-shrink-0">
                                {notif.sender.avatar_url ? (
                                    <img src={notif.sender.avatar_url} alt={notif.sender.username} className="w-12 h-12 rounded-full object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {notif.sender.username[0].toUpperCase()}
                                    </div>
                                )}
                            </button>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm dark:text-gray-200">
                                    <span className="font-bold hover:underline cursor-pointer" onClick={() => onNavigateToProfile(notif.sender.id)}>
                                        {notif.sender.username}
                                    </span>
                                    {' '}
                                    {notif.type === 'like' && 'liked your post'}
                                    {notif.type === 'comment' && 'commented on your post'}
                                    {notif.type === 'follow' && 'started following you'}
                                    <span className="text-gray-400 ml-2 text-xs">
                                        {new Date(notif.created_at).toLocaleDateString()}
                                    </span>
                                </p>
                            </div>

                            {notif.type === 'follow' && (
                                <button
                                    onClick={() => handleFollowBack(notif.sender.id)}
                                    className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Follow Back
                                </button>
                            )}

                            {(notif.type === 'like' || notif.type === 'comment') && notif.post_id && (
                                <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                    {/* Small preview of the post if available */}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
