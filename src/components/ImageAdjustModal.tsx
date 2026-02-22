import { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';

type ImageAdjustModalProps = {
    image: string;
    onClose: () => void;
    onComplete: (croppedImage: Blob) => void;
};

export function ImageAdjustModal({ image, onClose, onComplete }: ImageAdjustModalProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (
        imageSrc: string,
        pixelCrop: Area
    ): Promise<Blob> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('No 2d context');

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas is empty'));
                    return;
                }
                resolve(blob);
            }, 'image/jpeg');
        });
    };

    const handleSave = async () => {
        try {
            if (croppedAreaPixels) {
                const croppedImage = await getCroppedImg(image, croppedAreaPixels);
                onComplete(croppedImage);
                onClose();
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col backdrop-blur-sm animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <button
                    onClick={onClose}
                    className="p-2 text-white/70 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-white font-bold text-lg">Edit Media</h3>
                <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all active:scale-95"
                >
                    Save
                </button>
            </div>

            {/* Cropper Area */}
            <div className="flex-1 relative bg-black">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    cropShape="round"
                    showGrid={false}
                />
            </div>

            {/* Controls */}
            <div className="p-8 bg-black/40 backdrop-blur-md">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="flex items-center gap-6">
                        <ZoomOut className="w-5 h-5 text-white/50" />
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <ZoomIn className="w-5 h-5 text-white/50" />
                    </div>

                    <div className="flex justify-center">
                        <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-widest font-bold">
                            <Move className="w-4 h-4" />
                            Drag to reposition
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
