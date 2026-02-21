import { useState, useEffect, useRef } from 'react';
import { supabase, Profile, Message } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Send, Loader2, User } from 'lucide-react';

type MessagesProps = {
    onBack: () => void;
    onNavigateToProfile: (userId: string) => void;
};

export function Messages({ onBack, onNavigateToProfile }: MessagesProps) {
    const { user } = useAuth();
    const [mutualFollows, setMutualFollows] = useState<Profile[]>([]);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [loadingChat, setLoadingChat] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user) {
            loadMutualFollows();
        }
    }, [user]);

    useEffect(() => {
        if (selectedUser) {
            loadMessages();
            markMessagesAsRead();
            const subscription = subscribeToMessages();
            return () => {
                subscription.unsubscribe();
            };
        }
    }, [selectedUser]);

    async function markMessagesAsRead() {
        if (!user || !selectedUser) return;
        try {
            await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('receiver_id', user.id)
                .eq('sender_id', selectedUser.id)
                .eq('is_read', false);

            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('refreshUnreadCounts'));
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    async function loadMutualFollows() {
        try {
            // Find users who I follow AND who follow me
            const { data: following } = await supabase.from('follows').select('following_id').eq('follower_id', user?.id);
            const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', user?.id);

            const followingIds = following?.map(f => f.following_id) || [];
            const followerIds = followers?.map(f => f.follower_id) || [];

            const mutualIds = followingIds.filter(id => followerIds.includes(id));

            if (mutualIds.length === 0) {
                setMutualFollows([]);
                return;
            }

            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .in('id', mutualIds);

            if (error) throw error;
            setMutualFollows(profiles || []);
        } catch (err) {
            console.error('Error loading contacts:', err);
        } finally {
            setLoadingContacts(false);
        }
    }

    async function loadMessages() {
        if (!selectedUser || !user) return;
        setLoadingChat(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error loading messages:', err);
        } finally {
            setLoadingChat(false);
        }
    }

    function subscribeToMessages() {
        return supabase
            .channel('messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${user?.id}`
            }, (payload) => {
                const newMsg = payload.new as Message;
                if (newMsg.sender_id === selectedUser?.id) {
                    setMessages(prev => [...prev, newMsg]);
                    markMessagesAsRead(); // Mark as read immediately if chat is open
                }
            })
            .subscribe();
    }

    async function handleSendMessage(e: React.FormEvent) {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser || !user) return;

        const content = newMessage.trim();
        setNewMessage('');

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: selectedUser.id,
                    content
                })
                .select()
                .single();

            if (error) throw error;
            setMessages(prev => [...prev, data]);
        } catch (err) {
            console.error('Error sending message:', err);
            alert('Failed to send message');
        }
    }

    if (loadingContacts) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 h-[calc(100vh-64px)] flex border rounded-xl overflow-hidden mt-4 shadow-sm border-gray-200 dark:border-gray-800">
            {/* Contacts Sidebar */}
            <div className={`w-full md:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4">
                    <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                        <ArrowLeft className="w-5 h-5 dark:text-white" />
                    </button>
                    <h2 className="font-bold text-lg dark:text-white">Messages</h2>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/50">
                    {mutualFollows.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            No mutual follows found. Follow users who follow you to start chatting!
                        </div>
                    ) : (
                        mutualFollows.map((profile) => (
                            <button
                                key={profile.id}
                                onClick={() => setSelectedUser(profile)}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedUser?.id === profile.id ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                            >
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.username} className="w-12 h-12 rounded-full object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {profile.username[0].toUpperCase()}
                                    </div>
                                )}
                                <div className="text-left">
                                    <p className="font-semibold text-sm dark:text-white">{profile.username}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-[140px]">{profile.full_name}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col bg-white dark:bg-gray-950 ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
                {selectedUser ? (
                    <>
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedUser(null)} className="md:hidden p-1">
                                    <ArrowLeft className="w-5 h-5 dark:text-white" />
                                </button>
                                <button onClick={() => onNavigateToProfile(selectedUser.id)} className="flex items-center gap-3 hover:opacity-80">
                                    {selectedUser.avatar_url ? (
                                        <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                            {selectedUser.username[0].toUpperCase()}
                                        </div>
                                    )}
                                    <span className="font-bold text-sm dark:text-white">{selectedUser.username}</span>
                                </button>
                            </div>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-gray-900/20">
                            {loadingChat ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.sender_id === user?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-tl-none'}`}>
                                            {msg.content}
                                            <p className={`text-[10px] mt-1 opacity-60 text-right`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-full px-4 py-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Message..."
                                    className="flex-1 bg-transparent border-none focus:outline-none text-sm dark:text-white py-1"
                                />
                                <button type="submit" disabled={!newMessage.trim()} className="text-blue-600 disabled:opacity-30 p-1">
                                    <Send className="w-5 h-5 fill-current" />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-20 h-20 rounded-full border-2 border-gray-900 dark:border-white flex items-center justify-center mb-4">
                            <Send className="w-10 h-10 dark:text-white rotate-12" />
                        </div>
                        <h3 className="text-xl font-bold dark:text-white">Your Messages</h3>
                        <p className="text-gray-500 mt-2">Send private photos and messages to a friend.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
