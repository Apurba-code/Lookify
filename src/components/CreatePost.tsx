import { useState, useRef } from 'react';
import { X, MapPin, ChevronDown, Smile, Image as ImageIcon, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type CreatePostProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export function CreatePost({ onClose, onSuccess }: CreatePostProps) {
  const { user, profile } = useAuth();
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [mediaItems, setMediaItems] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Advanced Settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);
  const [disableComments, setDisableComments] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const commonLocations = [
    'New York, NY', 'Los Angeles, CA', 'London, UK', 'Tokyo, Japan',
    'Paris, France', 'Dubai, UAE', 'Dhaka, Bangladesh', 'Mumbai, India',
    'Berlin, Germany', 'Toronto, Canada', 'Sydney, Australia'
  ];

  const handleLocationChange = (val: string) => {
    setLocation(val);
    if (val.trim()) {
      const filtered = commonLocations.filter(loc =>
        loc.toLowerCase().includes(val.toLowerCase())
      );
      setLocationSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    setError('');

    try {
      const newUploads: { url: string; type: 'image' | 'video' }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        let type: 'image' | 'video' = 'image';
        if (['mp4', 'mov', 'webm'].includes(fileExt || '')) {
          type = 'video';
        }

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);

        newUploads.push({ url: data.publicUrl, type });
      }

      setMediaItems(prev => {
        const updated = [...prev, ...newUploads];
        if (prev.length === 0) {
          setCurrentIndex(0);
        }
        return updated;
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload one or more files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    if (e) e.preventDefault();
    if (!user || mediaItems.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        image_url: mediaItems[0].url, // Compatibility with single image field
        media: mediaItems, // The new multiple media field
        caption: caption.trim(),
        location: location.trim() || null,
        hide_likes: hideLikes,
        allow_comments: !disableComments,
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to create post. Ensure DB schema is updated.');
    } finally {
      setLoading(false);
    }
  }

  const removeMedia = (index: number) => {
    const newItems = mediaItems.filter((_, i) => i !== index);
    setMediaItems(newItems);
    if (currentIndex >= newItems.length) {
      setCurrentIndex(Math.max(0, newItems.length - 1));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl max-w-5xl w-full h-full max-h-[700px] flex flex-col overflow-hidden shadow-2xl transition-colors duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Create new post</h2>
          <button
            onClick={handleSubmit}
            disabled={loading || mediaItems.length === 0 || uploading}
            className="text-[#0095f6] hover:text-[#1877f2] font-bold text-sm disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            {loading ? 'Sharing...' : 'Share'}
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0">
          {/* Left Side: Media Upload/Preview */}
          <div className="w-full aspect-square md:aspect-auto md:flex-[1.6] bg-gray-50 dark:bg-zinc-900/50 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 relative group min-w-0 shrink-0 md:shrink">
            {mediaItems.length === 0 ? (
              <div className="flex flex-col items-center p-8 text-center w-full">
                <div className="w-24 h-24 mb-6 text-gray-400 flex items-center justify-center bg-gray-100 dark:bg-zinc-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                  <ImageIcon className="w-12 h-12" />
                </div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Drag photos and videos here</h3>
                <p className="text-gray-500 text-sm mb-8">Select up to 10 photos and videos</p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#0095f6] hover:bg-[#1877f2] text-white px-6 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg active:scale-95"
                >
                  Select from computer
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col bg-black relative min-w-0">
                {/* Main Preview */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black">
                  {mediaItems[currentIndex].type === 'video' ? (
                    <video
                      key={mediaItems[currentIndex].url}
                      src={mediaItems[currentIndex].url}
                      className="w-full h-full object-contain"
                      controls
                    />
                  ) : (
                    <img
                      src={mediaItems[currentIndex].url}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Prev/Next Buttons */}
                  {mediaItems.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white disabled:opacity-0 transition-opacity z-20"
                      >
                        <ChevronDown className="w-6 h-6 rotate-90" />
                      </button>
                      <button
                        onClick={() => setCurrentIndex(prev => Math.min(mediaItems.length - 1, prev + 1))}
                        disabled={currentIndex === mediaItems.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white disabled:opacity-0 transition-opacity z-20"
                      >
                        <ChevronDown className="w-6 h-6 -rotate-90" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails list at bottom */}
                <div className="p-4 bg-black/40 backdrop-blur-md flex gap-2 overflow-x-auto border-t border-white/10 scrollbar-none">
                  {mediaItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${currentIndex === idx ? 'border-[#0095f6] scale-105' : 'border-transparent opacity-60'}`}
                      onClick={() => setCurrentIndex(idx)}
                    >
                      {item.type === 'video' ? (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-zinc-500" />
                        </div>
                      ) : (
                        <img src={item.url} className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeMedia(idx); }}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-white transition-all border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-blue-500 active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,video/mp4,video/quicktime,video/webm"
              onChange={handleFileUpload}
              className="hidden"
            />

            {uploading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-black/60 flex items-center justify-center backdrop-blur-[2px] z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-900 dark:text-white text-sm font-medium">Uploading...</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Details */}
          <div className="w-full md:w-[340px] flex-1 md:flex-none flex flex-col bg-white dark:bg-[#121212] md:overflow-y-auto min-w-0">
            <div className="p-4">
              {/* User Identity */}
              <div className="flex items-center gap-3 mb-4">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-white">
                    {profile?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{profile?.username}</span>
              </div>

              {/* Caption Area */}
              <div className="relative mb-6">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
                  placeholder="Write a caption..."
                  className="w-full bg-transparent text-gray-900 dark:text-white text-base outline-none resize-none min-h-[160px] placeholder:text-gray-400 dark:placeholder:text-zinc-600"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-zinc-900 relative">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-3 shadow-2xl z-50 grid grid-cols-6 gap-2 animate-in fade-in zoom-in duration-200 min-w-[240px]">
                        {['❤️', '🙌', '🔥', '👏', '😢', '😍', '✨', '😂', '😮', '👍', '🙏', '❤️‍🔥', '🤩', '💯', '🤔', '😎', '🥳', '💡'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setCaption(prev => prev + emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="text-2xl hover:scale-125 transition-transform p-1"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-zinc-600 font-medium">
                    {caption.length}/2,200
                  </span>
                </div>
              </div>

              {/* Location */}
              <div className="relative border-t border-gray-50 dark:border-zinc-900">
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 flex-1">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      onFocus={() => location.trim() && setShowSuggestions(true)}
                      placeholder="Add location"
                      className="bg-transparent text-sm text-gray-900 dark:text-white outline-none w-full placeholder:text-gray-400 dark:placeholder:text-zinc-600"
                    />
                  </div>
                  {location && (
                    <button onClick={() => { setLocation(''); setShowSuggestions(false); }} className="text-xs text-[#0095f6] font-semibold">Clear</button>
                  )}
                </div>

                {showSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg shadow-xl mb-1 z-10 max-h-40 overflow-y-auto">
                    {locationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setLocation(suggestion);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                        <MapPin className="w-3 h-3 opacity-50" />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Advanced Settings Toggle */}
              <div className="border-t border-gray-50 dark:border-zinc-900">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between py-4 text-sm font-medium text-gray-900 dark:text-white hover:text-gray-500 dark:hover:text-zinc-300 transition-colors"
                >
                  <span>Advanced settings</span>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                {showAdvanced && (
                  <div className="space-y-6 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">Hide like and view counts</p>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-600 mt-1">Only you will see the total number of likes</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHideLikes(!hideLikes)}
                        className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${hideLikes ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${hideLikes ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">Turn off commenting</p>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-600 mt-1">You can change this later from the post menu</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDisableComments(!disableComments)}
                        className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${disableComments ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${disableComments ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 text-xs text-center border-t border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
