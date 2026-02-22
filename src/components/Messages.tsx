import { useState, useEffect, useRef } from 'react';
import { supabase, Profile, Message } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Loader2, User, ArrowLeft } from 'lucide-react';

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

    useEffect(() => {
        // Disable body scroll when messages are open
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    if (loadingContacts) {
        return (
            <div className="flex items-center justify-center p-12 h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 top-[60px] md:top-[80px] bottom-20 md:bottom-4 md:max-w-5xl md:mx-auto bg-white dark:bg-[#0a0a0a] flex md:border md:rounded-2xl overflow-hidden shadow-2xl border-gray-200 dark:border-zinc-800 z-30">
            {/* Contacts Sidebar */}
            <div className={`w-full md:w-[350px] border-r border-gray-100 dark:border-zinc-800 flex flex-col bg-white dark:bg-black/20 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-4 bg-white/50 dark:bg-black/40 backdrop-blur-md">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <ArrowLeft className="w-5 h-5 dark:text-white" />
                    </button>
                    <h2 className="font-bold text-xl dark:text-white tracking-tight">Messages</h2>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-900/50 scrollbar-none">
                    {mutualFollows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-3xl bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
                                <User className="w-8 h-8 text-gray-400 dark:text-zinc-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold dark:text-white">No contacts yet</p>
                                <p className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">Follow someone who follows you back to start chatting.</p>
                            </div>
                        </div>
                    ) : (
                        mutualFollows.map((profile) => (
                            <button
                                key={profile.id}
                                onClick={() => setSelectedUser(profile)}
                                className={`w-full p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-all border-l-4 ${selectedUser?.id === profile.id ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-900/10' : 'border-transparent'}`}
                            >
                                <div className="relative">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt={profile.username} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                                            {profile.username[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-black rounded-full" title="Online"></div>
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <p className="font-bold text-sm dark:text-white truncate">{profile.username}</p>
                                    <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{profile.full_name}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col bg-white dark:bg-[#0a0a0a] ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
                {selectedUser ? (
                    <>
                        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white/50 dark:bg-black/40 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                                    <ArrowLeft className="w-5 h-5 dark:text-white" />
                                </button>
                                <button onClick={() => onNavigateToProfile(selectedUser.id)} className="flex items-center gap-3 group">
                                    <div className="relative">
                                        {selectedUser.avatar_url ? (
                                            <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-10 h-10 rounded-xl object-cover border border-gray-100 dark:border-zinc-800" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                                {selectedUser.username[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-black rounded-full"></div>
                                    </div>
                                    <div className="text-left">
                                        <span className="font-bold text-sm dark:text-white block group-hover:text-blue-500 transition-colors">{selectedUser.username}</span>
                                        <span className="text-[10px] text-green-500 font-medium">Active now</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/20 dark:bg-black/20 scroll-smooth">
                            {loadingChat ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center h-full opacity-40">
                                    <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center mb-4">
                                        <Send className="w-8 h-8 text-blue-500" />
                                    </div>
                                    <p className="text-sm font-medium dark:text-zinc-400">Start your conversation</p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] md:max-w-[70%] p-4 rounded-2xl shadow-sm text-sm ${msg.sender_id === user?.id
                                            ? 'bg-[#0095f6] text-white rounded-tr-none'
                                            : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-700/50 rounded-tl-none'}`}>
                                            <p className="leading-relaxed">{msg.content}</p>
                                            <p className={`text-[9px] mt-2 font-medium uppercase tracking-tighter opacity-70 ${msg.sender_id === user?.id ? 'text-blue-50 text-right' : 'text-gray-400'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-black/60 backdrop-blur-md">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-gray-100 dark:bg-zinc-900 rounded-2xl px-4 py-3 border border-transparent focus-within:border-blue-500/50 focus-within:bg-white dark:focus-within:bg-black transition-all">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-transparent border-none focus:outline-none text-sm dark:text-white"
                                />
                                <button type="submit" disabled={!newMessage.trim()} className="text-[#0095f6] hover:text-[#1877f2] disabled:opacity-20 p-1 active:scale-90 transition-all">
                                    <Send className="w-6 h-6 fill-current" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-transparent to-blue-50/20 dark:to-blue-900/5">
                        <div className="w-24 h-24 rounded-[40px] bg-gradient-to-tr from-[#0095f6] to-[#00d2ff] flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20 ring-4 ring-white dark:ring-zinc-900 transform -rotate-6">
                            <Send className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold dark:text-white tracking-tight">Your Inbox</h3>
                        <p className="text-gray-500 dark:text-zinc-500 mt-2 max-w-[280px]">Send private photos and messages to your mutual followers.</p>
                        <button
                            onClick={() => { }}
                            className="mt-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
                        >
                            Send Message
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
