import { X, ChevronLeft, ChevronRight, Heart, Send, Volume2, VolumeX, Pause } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

type Story = {
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

type StoryViewerProps = {
    stories: Story[];
    initialIndex: number;
    onClose: () => void;
    hasNextUser?: boolean;
    hasPrevUser?: boolean;
    onNextUser?: () => void;
    onPrevUser?: () => void;
};

export function StoryViewer({ stories, initialIndex, onClose, hasNextUser, hasPrevUser, onNextUser, onPrevUser }: StoryViewerProps) {
    const { user } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [message, setMessage] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const STORY_DURATION = 5000; // 5 seconds for images

    const currentStory = stories[currentIndex];
    const isOwner = user?.id === currentStory.user_id;

    const canGoNext = currentIndex < stories.length - 1 || hasNextUser;
    const canGoPrev = currentIndex > 0 || hasPrevUser;

    const nextStory = useCallback(() => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
            setIsLiked(false);
            setIsPaused(false);
            setMessage('');
        } else if (hasNextUser && onNextUser) {
            onNextUser();
        }
    }, [currentIndex, stories.length, hasNextUser, onNextUser]);

    const prevStory = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
            setIsLiked(false);
            setIsPaused(false);
            setMessage('');
        } else if (hasPrevUser && onPrevUser) {
            onPrevUser();
        }
    }, [currentIndex, hasPrevUser, onPrevUser]);

    const togglePause = () => {
        setIsPaused(prev => !prev);
    };

    // Handle Image Progress
    useEffect(() => {
        if (currentStory.media_type === 'video' || isPaused) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    if (canGoNext) {
                        nextStory();
                    }
                    return 0;
                }
                return prev + (100 / (STORY_DURATION / 100));
            });
        }, 100);

        return () => clearInterval(interval);
    }, [nextStory, currentStory.media_type, isPaused]);

    // Handle Video Play/Pause State
    useEffect(() => {
        if (videoRef.current && currentStory.media_type === 'video') {
            if (isPaused) {
                videoRef.current.pause();
            } else {
                videoRef.current.play().catch(err => console.error("Video play blocked:", err));
            }
        }
    }, [isPaused, currentIndex, currentStory.media_type]);

    // Handle Video Progress
    const handleVideoTimeUpdate = () => {
        if (videoRef.current && !isPaused) {
            const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(currentProgress);
        }
    };

    const handleVideoEnded = () => {
        if (canGoNext) {
            nextStory();
        } else if (videoRef.current) {
            // Replay automatically if absolute last story
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    };

    // Handle video unmuting on first interaction or when toggled
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
        }
    }, [isMuted, currentIndex]);

    const getTimeAgo = (dateStr?: string) => {
        if (!dateStr) return 'now';
        const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    const handleLike = (e: React.MouseEvent) => {
        if (isOwner) return;
        e.stopPropagation();
        setIsLiked(!isLiked);
    };

    const handleSendMessage = (e: React.MouseEvent) => {
        if (isOwner) return;
        e.stopPropagation();
        if (message.trim()) {
            alert(`Message sent to ${currentStory.profiles.username}: ${message}`);
            setMessage('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center select-none overflow-hidden">
            {/* Top Bar Branding */}
            <div className="absolute top-6 left-6 flex items-center gap-2 z-50">
                <img src={logo} alt="Lookify" className="w-9 h-9 object-contain" />
                <span className="text-white font-bold text-xl tracking-tight">Lookify</span>
            </div>

            {/* Global Close Button */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-6 right-6 text-white/70 hover:text-white z-50 p-2 hover:bg-white/10 rounded-full transition-all"
            >
                <X className="w-8 h-8" />
            </button>

            {/* Main Navigation Arrows (Desktop) */}
            <div className="hidden md:flex absolute inset-x-0 top-1/2 -translate-y-1/2 justify-between px-12 z-50 pointer-events-none">
                <button
                    onClick={(e) => { e.stopPropagation(); prevStory(); }}
                    disabled={!canGoPrev}
                    className={`pointer-events-auto p-4 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-full text-white transition-all shadow-xl ${!canGoPrev ? 'opacity-0 cursor-default' : 'opacity-100 active:scale-95'}`}
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); nextStory(); }}
                    disabled={!canGoNext}
                    className={`pointer-events-auto p-4 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-full text-white transition-all shadow-xl ${!canGoNext ? 'opacity-0 cursor-default' : 'opacity-100 active:scale-95'}`}
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>

            {/* Story Card Container */}
            <div
                className="relative w-full max-w-[480px] h-[90vh] md:h-[85vh] bg-black shadow-2xl overflow-hidden rounded-[24px] border border-zinc-800/50 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Story Media */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {currentStory.media_type === 'video' ? (
                        <video
                            ref={videoRef}
                            key={currentStory.id}
                            src={currentStory.media_url}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                            onTimeUpdate={handleVideoTimeUpdate}
                            onEnded={handleVideoEnded}
                        />
                    ) : (
                        <img
                            key={currentStory.id}
                            src={currentStory.media_url}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

                {/* Pause Indicator Overlay */}
                {isPaused && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/10 transition-opacity duration-300">
                        <div className="p-5 bg-black/40 backdrop-blur-md rounded-full ring-1 ring-white/20">
                            <Pause className="w-10 h-10 text-white fill-white" />
                        </div>
                    </div>
                )}

                {/* Top Content (Progress & Header) */}
                <div className="relative z-10 p-4 pt-4 space-y-4">
                    <div className="flex gap-1.5 px-0.5">
                        {stories.map((_, i) => (
                            <div key={i} className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-100 ease-linear"
                                    style={{
                                        width: i === currentIndex ? `${progress}%` : i < currentIndex ? '100%' : '0%'
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-white/50 p-0.5 bg-white/10 backdrop-blur-sm relative shadow-lg">
                                {currentStory.profiles.avatar_url ? (
                                    <img src={currentStory.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-xs text-white font-bold">
                                        {currentStory.profiles.username[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col text-left">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-sm tracking-wide drop-shadow-md">
                                        {currentStory.profiles.username}
                                    </span>
                                    <span className="text-white/60 text-xs font-medium">• {getTimeAgo(currentStory.created_at)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                                className="p-1.5 text-white/80 hover:text-white transition-colors"
                            >
                                {isMuted ? <VolumeX className="w-5 h-5 drop-shadow-md" /> : <Volume2 className="w-5 h-5 drop-shadow-md" />}
                            </button>
                            <button className="p-1.5 text-white/80 hover:text-white transition-colors">
                                <X className="w-5 h-5 drop-shadow-md" onClick={(e) => { e.stopPropagation(); onClose(); }} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Navigation & Pause Hotspots */}
                <div className="absolute inset-0 flex z-30">
                    <div className="w-[30%] h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); canGoPrev && prevStory(); }} title="Previous" />
                    <div className="w-[40%] h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); togglePause(); }} title={isPaused ? "Play" : "Pause"} />
                    <div className="w-[30%] h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); canGoNext && nextStory(); }} title="Next" />
                </div>

                {/* Bottom Interaction Bar */}
                {!isOwner && (
                    <div className="mt-auto relative z-40 p-5 pb-8 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-white/10 backdrop-blur-md rounded-full px-5 py-3.5 border border-white/10 group focus-within:bg-white/15 transition-all">
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Send a message..."
                                    className="w-full bg-transparent border-none outline-none text-[15px] text-white placeholder:text-white/60"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <button
                                className={`p-3 bg-white/10 backdrop-blur-md rounded-full transition-all border border-white/10 active:scale-90 ${isLiked ? 'text-red-500 bg-white/20' : 'text-white'}`}
                                onClick={handleLike}
                            >
                                <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                className="p-3.5 bg-blue-500 rounded-full text-white shadow-lg shadow-blue-500/20 active:scale-90 transition-all disabled:opacity-50"
                                onClick={handleSendMessage}
                                disabled={!message.trim()}
                            >
                                <Send className="w-6 h-6 fill-white -translate-x-0.5 translate-y-0.5 rotate-[-15deg]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
