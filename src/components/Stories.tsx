import { Plus, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { StoryViewer } from './StoryViewer';

type StoryWithProfile = {
    id: string;
    media_url: string;
    media_type: string;
    user_id: string;
    profiles: {
        username: string;
        avatar_url: string | null;
    };
    created_at?: string;
};

export function Stories() {
    const { profile, user } = useAuth();
    const [groupedStories, setGroupedStories] = useState<Record<string, StoryWithProfile[]>>({});
    const [isUploading, setIsUploading] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchStories();
    }, [user]);

    async function fetchStories() {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('stories')
                .select(`
                    *,
                    profiles:user_id (username, avatar_url)
                `)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: true }); // Segments in chronological order

            if (error) throw error;

            const groups: Record<string, StoryWithProfile[]> = {};
            (data || []).forEach((s: any) => {
                if (!groups[s.user_id]) groups[s.user_id] = [];
                groups[s.user_id].push(s);
            });

            setGroupedStories(groups);
        } catch (err) {
            console.error('Error fetching stories:', err);
        }
    }

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0 || !user) return;

        setIsUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type.startsWith('video/')) {
                    // Check duration for each video
                    await new Promise<void>((resolve) => {
                        const video = document.createElement('video');
                        video.preload = 'metadata';
                        video.onloadedmetadata = async () => {
                            window.URL.revokeObjectURL(video.src);
                            if (video.duration > 20) {
                                alert(`Video "${file.name}" is too long (max 20s). Skipping.`);
                                resolve();
                                return;
                            }
                            await uploadStory(file);
                            resolve();
                        };
                        video.src = URL.createObjectURL(file);
                    });
                } else {
                    await uploadStory(file);
                }
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await fetchStories();
        }
    }

    async function uploadStory(file: File) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${user!.id}/${fileName}`;
            const mediaType = file.type.startsWith('video') ? 'video' : 'image';

            // 1. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('stories')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('stories')
                .getPublicUrl(filePath);

            // 3. Insert into DB
            const { error: dbError } = await supabase
                .from('stories')
                .insert({
                    user_id: user!.id,
                    media_url: publicUrl,
                    media_type: mediaType
                });

            if (dbError) throw dbError;
        } catch (error) {
            console.error('Error uploading story:', error);
            alert(`Failed to upload story: ${file.name}`);
        }
    }

    // Get list of users who have stories (sorted by latest story time)
    const activeUserIds = Object.keys(groupedStories).sort((a, b) => {
        const aLatest = new Date(groupedStories[a][groupedStories[a].length - 1].created_at || 0).getTime();
        const bLatest = new Date(groupedStories[b][groupedStories[b].length - 1].created_at || 0).getTime();
        return bLatest - aLatest;
    });

    return (
        <>
            <div className="flex gap-3 overflow-x-auto py-4 px-1 scrollbar-hide -mx-1">
                {/* Create Story Button */}
                <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className="relative flex-shrink-0 w-28 aspect-[9/16] rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 cursor-pointer group shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="You" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity blur-[1px] group-hover:blur-0" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                            <Camera className="w-8 h-8 text-zinc-600" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="bg-[#0095f6] p-2 rounded-full shadow-lg border-2 border-white dark:border-gray-950 group-hover:scale-110 transition-transform">
                            {isUploading ? (
                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                            ) : (
                                <Plus className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <span className="text-[11px] font-bold text-white drop-shadow-md">Add Story</span>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        multiple
                    />
                </div>

                {/* Grouped User Stories */}
                {activeUserIds.map((userId) => {
                    const userStories = groupedStories[userId];
                    const latestStory = userStories[userStories.length - 1];

                    return (
                        <div
                            key={userId}
                            onClick={() => setSelectedUserId(userId)}
                            className="relative flex-shrink-0 w-28 aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 cursor-pointer group shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                            {latestStory.media_type === 'video' ? (
                                <video src={latestStory.media_url} className="w-full h-full object-cover" />
                            ) : (
                                <img src={latestStory.media_url} alt="" className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

                            {/* Segment Indicators (Instagram style) */}
                            <div className="absolute top-2 left-2 right-2 flex gap-0.5 z-20">
                                {userStories.map((_, i) => (
                                    <div key={i} className="flex-1 h-[2px] bg-white/40 rounded-full" />
                                ))}
                            </div>

                            <div className="absolute top-4 left-2 flex items-center gap-1.5 p-1 rounded-full bg-black/20 backdrop-blur-sm">
                                <div className="w-6 h-6 rounded-full border border-[#0095f6] p-[1px]">
                                    {latestStory.profiles.avatar_url ? (
                                        <img src={latestStory.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-white">
                                            {latestStory.profiles.username[0]}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="absolute bottom-3 left-3 right-3 text-[10px] font-bold text-white truncate drop-shadow-md text-center">
                                {latestStory.profiles.username}
                            </span>
                        </div>
                    );
                })}
            </div>

            {selectedUserId && (
                <StoryViewer
                    stories={groupedStories[selectedUserId]}
                    initialIndex={0}
                    onClose={() => setSelectedUserId(null)}
                    hasNextUser={activeUserIds.indexOf(selectedUserId) < activeUserIds.length - 1}
                    hasPrevUser={activeUserIds.indexOf(selectedUserId) > 0}
                    onNextUser={() => {
                        const idx = activeUserIds.indexOf(selectedUserId);
                        if (idx < activeUserIds.length - 1) {
                            setSelectedUserId(activeUserIds[idx + 1]);
                        }
                    }}
                    onPrevUser={() => {
                        const idx = activeUserIds.indexOf(selectedUserId);
                        if (idx > 0) {
                            setSelectedUserId(activeUserIds[idx - 1]);
                        }
                    }}
                />
            )}
        </>
    );
}
