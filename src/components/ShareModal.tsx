import { useState, useEffect } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Send, Loader2, Check } from 'lucide-react';
import { Modal } from './Modal';

type ShareModalProps = {
    isOpen: boolean;
    onClose: () => void;
    postUrl: string;
};

export function ShareModal({ isOpen, onClose, postUrl }: ShareModalProps) {
    const { user } = useAuth();
    const [mutualFollows, setMutualFollows] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            loadMutualFollows();
        }
    }, [isOpen, user]);

    async function loadMutualFollows() {
        setLoading(true);
        try {
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
            setLoading(false);
        }
    }

    const filteredUsers = mutualFollows.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    async function handleShare() {
        if (selectedUsers.length === 0 || !user) return;
        setSharing(true);

        try {
            const shareMessage = `Check out this post: ${postUrl}`;

            const sharePromises = selectedUsers.map(receiverId =>
                supabase.from('messages').insert({
                    sender_id: user.id,
                    receiver_id: receiverId,
                    content: shareMessage
                })
            );

            await Promise.all(sharePromises);

            setShareSuccess(true);
            setTimeout(() => {
                onClose();
                setShareSuccess(false);
                setSelectedUsers([]);
            }, 1500);
        } catch (err) {
            console.error('Error sharing post:', err);
            alert('Failed to share post');
        } finally {
            setSharing(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share">
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search for a user..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-lg focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {loading ? (
                        <div className="py-8 flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500">No mutual followers found.</p>
                    ) : (
                        filteredUsers.map(u => (
                            <button
                                key={u.id}
                                onClick={() => toggleUser(u.id)}
                                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {u.avatar_url ? (
                                        <img src={u.avatar_url} alt={u.username} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                            {u.username[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="text-left">
                                        <p className="font-semibold text-sm dark:text-white">{u.username}</p>
                                        <p className="text-xs text-gray-500">{u.full_name}</p>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedUsers.includes(u.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {selectedUsers.includes(u.id) && <Check className="w-4 h-4" />}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <button
                    onClick={handleShare}
                    disabled={selectedUsers.length === 0 || sharing || shareSuccess}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                    {shareSuccess ? (
                        <>
                            <Check className="w-5 h-5" />
                            Shared!
                        </>
                    ) : sharing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sharing...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Send to {selectedUsers.length > 0 ? `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}` : '...'}
                        </>
                    )}
                </button>
            </div>
        </Modal>
    );
}
