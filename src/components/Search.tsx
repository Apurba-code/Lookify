import { useState, useEffect } from 'react';
import { Search as SearchIcon, UserPlus, UserCheck } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type SearchProps = {
    onNavigateToProfile: (userId: string) => void;
};

export function Search({ onNavigateToProfile }: SearchProps) {
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (currentUser) {
            loadFollowing();
        }
    }, [currentUser]);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (searchTerm) {
                handleSearch();
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [searchTerm]);

    async function loadFollowing() {
        if (!currentUser) return;
        try {
            const { data } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', currentUser.id);

            if (data) {
                setFollowingIds(new Set(data.map(f => f.following_id)));
            }
        } catch (error) {
            console.error('Error loading following:', error);
        }
    }

    async function handleSearch() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .ilike('username', `%${searchTerm}%`)
                .limit(20);

            if (error) throw error;
            setResults(data || []);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleFollow(userId: string) {
        if (!currentUser || userId === currentUser.id) return;

        try {
            if (followingIds.has(userId)) {
                await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', currentUser.id)
                    .eq('following_id', userId);

                setFollowingIds(prev => {
                    const next = new Set(prev);
                    next.delete(userId);
                    return next;
                });
            } else {
                await supabase
                    .from('follows')
                    .insert({ follower_id: currentUser.id, following_id: userId });

                setFollowingIds(prev => {
                    const next = new Set(prev);
                    next.add(userId);
                    return next;
                });
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="relative mb-8">
                <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search for people..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-lg"
                    autoFocus
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : results.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {results.map((profile) => (
                        <div key={profile.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
                            <div
                                onClick={() => onNavigateToProfile(profile.id)}
                                className="cursor-pointer mb-4"
                            >
                                {profile.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt={profile.username}
                                        className="w-24 h-24 rounded-full object-cover mx-auto"
                                    />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold mx-auto">
                                        {profile?.username?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}
                            </div>

                            <h3
                                onClick={() => onNavigateToProfile(profile.id)}
                                className="font-bold text-lg text-gray-900 dark:text-white mb-1 cursor-pointer hover:text-blue-600"
                            >
                                {profile.username}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">{profile.bio || 'No bio yet'}</p>

                            {profile.id !== currentUser?.id && (
                                <button
                                    onClick={() => handleFollow(profile.id)}
                                    className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${followingIds.has(profile.id)
                                        ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {followingIds.has(profile.id) ? (
                                        <>
                                            <UserCheck className="w-4 h-4" />
                                            Following
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="w-4 h-4" />
                                            Follow
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : searchTerm ? (
                <div className="text-center py-12 text-gray-500">
                    No users found matching "{searchTerm}"
                </div>
            ) : (
                <div className="text-center py-16 text-gray-400">
                    <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>Search for users by username</p>
                </div>
            )}
        </div>
    );
}
