import { useState, useEffect, useRef } from 'react';
import { supabase, Profile, Message } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Loader2, User, ArrowLeft, Image as ImageIcon, Smile, Trash2, Edit, X } from 'lucide-react';

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
    const [isTyping, setIsTyping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const chatChannelRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            loadMutualFollows();
        }
    }, [user]);

    useEffect(() => {
        if (selectedUser) {
            loadMessages();
            markMessagesAsRead();

            // Subscribe to message updates (Sent/Seen status)
            const msgSubscription = subscribeToMessages();

            // Subscribe to the selected user's profile updates (Active status)
            const profileSubscription = supabase
                .channel(`profile:${selectedUser.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${selectedUser.id}`
                }, (payload) => {
                    const updatedProfile = payload.new as Profile;
                    setSelectedUser(prev => prev?.id === updatedProfile.id ? { ...prev, ...updatedProfile } : prev);
                    // Also update in the mutual follows list
                    setMutualFollows(prev => prev.map(p => p.id === updatedProfile.id ? { ...p, ...updatedProfile } : p));
                })
                .subscribe();

            return () => {
                msgSubscription?.unsubscribe();
                profileSubscription.unsubscribe();
                chatChannelRef.current = null;
            };
        }
    }, [selectedUser]);

    // Force refresh relative times (Active 2m ago, Sent 5m ago) every 60 seconds
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    async function markMessagesAsRead() {
        if (!user || !selectedUser) return;
        try {
            const { error } = await supabase
                .from('messages')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('receiver_id', user.id)
                .eq('sender_id', selectedUser.id)
                .eq('is_read', false);

            if (error) throw error;

            // Notify other components
            window.dispatchEvent(new CustomEvent('refreshUnreadCounts'));
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }

    const getTimeAgo = (dateStr?: string | null) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const getActiveStatus = (lastSeen?: string | null) => {
        if (!lastSeen) return null;
        const lastSeenDate = new Date(lastSeen);
        const diffInMinutes = (new Date().getTime() - lastSeenDate.getTime()) / 60000;

        if (diffInMinutes < 5) {
            return { label: 'Active now', isOnline: true };
        } else {
            return { label: `Active ${getTimeAgo(lastSeen)}`, isOnline: false };
        }
    };

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
                .select('*, stories(*, profiles:user_id(username))')
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
        if (!user || !selectedUser) return;

        const channelId = [user.id, selectedUser.id].sort().join('_');
        const channel = supabase.channel(`chat:room:${channelId}`);
        chatChannelRef.current = channel;

        return channel
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as Message;
                    if (newMsg.receiver_id === user.id && newMsg.sender_id === selectedUser.id) {
                        setMessages(prev => [...prev, newMsg]);
                        markMessagesAsRead();
                        setIsTyping(false);
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const updatedMsg = payload.new as Message;
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
                }
            })
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (payload.userId === selectedUser.id) {
                    setIsTyping(true);
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
                }
            })
            .subscribe();
    }

    const handleTyping = () => {
        if (chatChannelRef.current) {
            chatChannelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user?.id }
            });
        }
    };

    async function handleSendMessage(e: React.FormEvent) {
        e.preventDefault();
        if ((!newMessage.trim() && !uploading) || !selectedUser || !user) return;

        const content = newMessage.trim();
        setNewMessage('');

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: selectedUser.id,
                    content,
                    is_read: false
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

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !user || !selectedUser) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('message-media')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('message-media')
                .getPublicUrl(fileName);

            const { data, error: msgError } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: selectedUser.id,
                    content: '',
                    media_url: publicUrl,
                    media_type: file.type.startsWith('video') ? 'video' : 'image',
                    is_read: false
                })
                .select()
                .single();

            if (msgError) throw msgError;
            setMessages(prev => [...prev, data]);
        } catch (err: any) {
            console.error('Error uploading file:', err);
            alert(`Failed to upload file: ${err.message || 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    }

    async function handleDeleteMessage(messageId: string) {
        if (!confirm('Are you sure you want to delete this message?')) return;

        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId);

            if (error) throw error;
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    }

    async function handleEditMessage(messageId: string, newContent: string) {
        if (!newContent.trim()) return;

        try {
            const { error } = await supabase
                .from('messages')
                .update({
                    content: newContent,
                    updated_at: new Date().toISOString()
                })
                .eq('id', messageId);

            if (error) throw error;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, updated_at: new Date().toISOString() } : m));
            setEditingMessage(null);
            setNewMessage(''); // Clear input after edit
        } catch (err) {
            console.error('Error editing message:', err);
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
                                    {getActiveStatus(profile.last_seen)?.isOnline && (
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-black rounded-full" title="Online"></div>
                                    )}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <p className="font-bold text-sm dark:text-white truncate">{profile.username}</p>
                                    <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                                        {getActiveStatus(profile.last_seen)?.label || profile.full_name}
                                    </p>
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
                                        <span className={`text-[10px] font-medium ${getActiveStatus(selectedUser.last_seen)?.isOnline ? 'text-green-500' : 'text-gray-400'}`}>
                                            {getActiveStatus(selectedUser.last_seen)?.label}
                                        </span>
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
                                    <div key={msg.id} className={`flex flex-col group ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
                                        <div className="relative flex items-center gap-2 max-w-[80%] md:max-w-[70%]">
                                            {msg.sender_id === user?.id && (
                                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingMessage(msg);
                                                            setNewMessage(msg.content); // Set initial edit text
                                                        }}
                                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-500"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className={`p-3.5 rounded-2xl shadow-sm text-sm ${msg.sender_id === user?.id
                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-700/50 rounded-tl-none'}`}>

                                                {(msg as any).stories && (
                                                    <div className="mb-3 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-3 p-2 group-hover:bg-black/10 transition-colors">
                                                        <div className="w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                                                            {(msg as any).stories.media_type === 'video' ? (
                                                                <video src={(msg as any).stories.media_url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <img src={(msg as any).stories.media_url} alt="Story" className="w-full h-full object-cover" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <p className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-0.5">Replied to story</p>
                                                            <p className="text-[11px] truncate opacity-80 italic">Story by {(msg as any).stories.profiles?.username || 'user'}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {msg.media_url && (
                                                    <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-white/10">
                                                        {msg.media_type === 'video' ? (
                                                            <video src={msg.media_url} controls className="max-h-60" />
                                                        ) : (
                                                            <img src={msg.media_url} alt="Sent photo" className="max-h-60 object-contain" />
                                                        )}
                                                    </div>
                                                )}

                                                {msg.content && <p className="leading-relaxed">{msg.content}</p>}

                                                {msg.updated_at && (
                                                    <p className="text-[10px] opacity-60 mt-1 italic">Edited</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 px-1">
                                            <p className={`text-[10px] font-bold tracking-tight ${msg.sender_id === user?.id && msg.is_read ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-zinc-500'}`}>
                                                {msg.sender_id === user?.id
                                                    ? (msg.is_read
                                                        ? `Seen ${getTimeAgo(msg.read_at) || 'just now'}`
                                                        : `Sent ${getTimeAgo(msg.created_at)}`)
                                                    : getTimeAgo(msg.created_at)
                                                }
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-zinc-700/50 flex gap-1 items-center shadow-sm">
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-black/60 backdrop-blur-md">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-gray-100 dark:bg-zinc-900 rounded-2xl px-4 py-2 border border-transparent focus-within:border-blue-500/50 focus-within:bg-white dark:focus-within:bg-black transition-all">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 text-gray-500 hover:text-blue-500 transition-colors"
                                    disabled={uploading}
                                >
                                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    accept="image/*,video/*"
                                />

                                <button
                                    type="button"
                                    className="p-1.5 text-gray-500 hover:text-yellow-500 transition-colors"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                >
                                    <Smile className="w-5 h-5" />
                                </button>

                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => {
                                        setNewMessage(e.target.value);
                                        handleTyping();
                                    }}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-transparent border-none focus:outline-none text-sm dark:text-white py-2"
                                />
                                <button type="submit" disabled={!newMessage.trim() && !uploading} className="text-[#0095f6] hover:text-[#1877f2] disabled:opacity-20 p-1 active:scale-90 transition-all">
                                    <Send className="w-6 h-6 fill-current" />
                                </button>
                            </form>

                            {/* Simple Emoji Picker */}
                            {showEmojiPicker && (
                                <div className="absolute bottom-[80px] left-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-2xl z-20 grid grid-cols-6 gap-2 animate-in fade-in zoom-in duration-200">
                                    {['❤️', '🙌', '🔥', '👏', '😢', '😍', '✨', '😂', '😮', '👍', '🙏', '❤️‍🔥'].map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => {
                                                setNewMessage(prev => prev + emoji);
                                                setShowEmojiPicker(false);
                                            }}
                                            className="text-2xl hover:scale-125 transition-transform"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Simple Message Edit Mode Overlay */}
                            {editingMessage && (
                                <div className="absolute inset-x-0 bottom-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4 z-10 animate-in slide-in-from-bottom duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold text-gray-500">Edit Message</p>
                                        <button onClick={() => setEditingMessage(null)}>
                                            <X className="w-4 h-4 text-gray-400" />
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditMessage(editingMessage.id, newMessage);
                                                if (e.key === 'Escape') setEditingMessage(null);
                                            }}
                                            className="flex-1 bg-gray-100 dark:bg-black rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => handleEditMessage(editingMessage.id, newMessage)}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            )}
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
