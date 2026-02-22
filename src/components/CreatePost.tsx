import { useState, useRef } from 'react';
import { X, Camera, Image, Wand2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type CreatePostProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export function CreatePost({ onClose, onSuccess }: CreatePostProps) {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'url' | 'device'>('url');

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt} `;
      const filePath = `${user.id}/${fileName}`;

      let type: 'image' | 'video' = 'image';
      if (['mp4', 'mov', 'webm'].includes(fileExt || '')) {
        type = 'video';
      }
      setMediaType(type);

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath);

      setMediaUrl(data.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !mediaUrl.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        image_url: mediaUrl.trim(), // Note: treating image_url as generic media url
        caption: caption.trim(),
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Create New Post</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setUploadMethod('url')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${uploadMethod === 'url'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                From URL
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('device')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${uploadMethod === 'device'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                Upload from Device
              </button>
            </div>

            {uploadMethod === 'url' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Media URL (Image or Video)
                </label>
                <div className="relative">
                  <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => {
                      setMediaUrl(e.target.value);
                      // Simple check for video extension in URL
                      if (e.target.value.match(/\.(mp4|mov|webm)$/i)) {
                        setMediaType('video');
                      } else {
                        setMediaType('image');
                      }
                    }}
                    placeholder="https://example.com/image.jpg or video.mp4"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent dark:text-white"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Paste a direct link to an image or video (mp4)
                </p>
              </div>
            )}

            {uploadMethod === 'device' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Choose Image
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/quicktime,video/webm"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {uploading ? 'Uploading...' : 'Upload an image from your device'}
                </p>
              </div>
            )}
          </div>

          {mediaUrl && (
            <div className="mb-6">
              {mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  className="w-full aspect-square object-cover rounded-lg"
                  controls
                  onError={() => setError('Invalid video URL')}
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt="Preview"
                  className="w-full aspect-square object-cover rounded-lg"
                  onError={() => setError('Invalid image URL')}
                />
              )}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-transparent dark:text-white"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !mediaUrl.trim() || uploading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Posting...' : uploading ? 'Uploading...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
