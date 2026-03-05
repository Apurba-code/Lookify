import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type ProfilePicCarouselProps = {
    images: { url: string; created_at: string }[];
    onClose: () => void;
};

export function ProfilePicCarousel({ images, onClose }: ProfilePicCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const next = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex < images.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const prev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    if (images.length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <button
                onClick={onClose}
                className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
            >
                <X className="w-8 h-8" />
            </button>

            <div className="relative w-full max-w-2xl aspect-square flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <img
                    src={images[currentIndex].url}
                    alt="Profile"
                    className="w-full h-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
                />

                {/* Arrows */}
                {currentIndex > 0 && (
                    <button
                        onClick={prev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}
                {currentIndex < images.length - 1 && (
                    <button
                        onClick={next}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all active:scale-95"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}

                {/* Info Overlay */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/10">
                    {new Date(images[currentIndex].created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    <span className="ml-3 opacity-60">{currentIndex + 1} / {images.length}</span>
                </div>
            </div>
        </div>
    );
}
