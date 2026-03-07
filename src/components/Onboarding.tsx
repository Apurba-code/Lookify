import { useState, useRef } from 'react';
import { Camera, Calendar, Upload, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import logo from '../assets/logo.png';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ImageAdjustModal } from './ImageAdjustModal';

type OnboardingProps = {
    onComplete: () => void;
};

export function Onboarding({ onComplete }: OnboardingProps) {
    const { user, refreshProfile } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [gender, setGender] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [bio, setBio] = useState('');

    const [avatar, setAvatar] = useState<Blob | null>(null);
    const [avatarPreview, setAvatarPreview] = useState('');

    const [cover, setCover] = useState<Blob | null>(null);
    const [coverPreview, setCoverPreview] = useState('');

    const [adjustImage, setAdjustImage] = useState<string | null>(null);
    const [adjustType, setAdjustType] = useState<'avatar' | 'cover'>('avatar');
    const [showAdjustModal, setShowAdjustModal] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setAdjustImage(reader.result as string);
                setAdjustType(type);
                setShowAdjustModal(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCropComplete = (croppedBlob: Blob) => {
        if (adjustType === 'avatar') {
            setAvatar(croppedBlob);
            setAvatarPreview(URL.createObjectURL(croppedBlob));
        } else {
            setCover(croppedBlob);
            setCoverPreview(URL.createObjectURL(croppedBlob));
        }
        setShowAdjustModal(false);
    };

    const handleNext = async () => {
        setError('');

        if (step === 1) {
            if (!gender || !birthDate) {
                setError('Please fill in all fields');
                return;
            }
            try {
                await supabase
                    .from('profiles')
                    .update({
                        gender,
                        birth_date: birthDate
                    })
                    .eq('id', user?.id);
            } catch (err) {
                console.error('Error persisting step 1:', err);
            }
            setStep(2);
        } else if (step === 2) {
            await handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!user) return;
        setLoading(true);

        try {
            let avatarUrl = null;
            let coverUrl = null;

            // Upload Avatar
            if (avatar) {
                const fileName = `${user.id}/${Math.random()}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, avatar, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                avatarUrl = publicUrl;
            }

            // Upload Cover
            if (cover) {
                const fileName = `${user.id}/cover_${Math.random()}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from('profile-covers')
                    .upload(fileName, cover, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) {
                    console.error('Error uploading cover:', uploadError);
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('profile-covers')
                        .getPublicUrl(fileName);
                    coverUrl = publicUrl;
                }
            }

            const updateData: any = {
                gender,
                birth_date: birthDate,
                bio,
            };

            if (avatarUrl) updateData.avatar_url = avatarUrl;
            if (coverUrl) updateData.cover_url = coverUrl;

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id);

            if (updateError) throw updateError;

            await refreshProfile();
            onComplete();
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen h-[100dvh] w-full bg-white dark:bg-zinc-950 flex flex-col md:flex-row selection:bg-blue-100 overflow-hidden">
            {/* Left side - Brand Messaging */}
            <div className="w-full md:w-[40%] h-[35%] md:h-full bg-zinc-950 p-10 md:p-16 flex flex-col justify-between relative overflow-hidden shrink-0">
                {/* Abstract Decorative Shapes */}
                <div className="absolute top-[30%] -left-10 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[20%] left-[20%] w-64 h-64 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3">
                    <img src={logo} alt="Lookify Logo" className="w-10 h-10 object-contain" />
                    <span className="text-2xl font-bold text-white tracking-tight font-heading">Lookify</span>
                </div>

                <div className="relative z-10">
                    <div className="flex gap-2 mb-8">
                        {[1, 2].map((i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-12 bg-blue-500' : 'w-4 bg-zinc-800'}`} />
                        ))}
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6 font-heading tracking-tight">
                        {step === 1 ? (
                            <>Tell us a bit <span className="text-blue-500 italic">about</span> yourself.</>
                        ) : (
                            <>Perfect! Now, <span className="text-blue-500 italic">show</span> the world.</>
                        )}
                    </h2>
                    <p className="text-zinc-400 text-lg md:text-xl leading-relaxed font-medium">
                        {step === 1
                            ? "Complete your basic profile info to start connecting with the creative community."
                            : "Upload your photos and add a quick bio to let others know who you are."
                        }
                    </p>
                </div>

                <div className="relative z-10 mt-12 text-zinc-600 text-xs tracking-widest uppercase font-bold">
                    © 2026 LOOKIFY CO. ALL RIGHTS RESERVED.
                </div>
            </div>

            {/* Right side - Onboarding Form */}
            <div className="flex-1 flex flex-col p-10 md:p-16 relative bg-white dark:bg-zinc-950 overflow-y-auto scrollbar-hide">

                <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto space-y-10 my-auto">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-sm tracking-widest uppercase mb-1">
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">STEP {step} OF 2</span>
                        </div>
                        <h3 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white font-heading">
                            {step === 1 ? "Basic Information" : "Profile Aesthetic"}
                        </h3>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm py-3 px-4 bg-red-50 dark:bg-red-500/10 rounded-xl text-center font-bold border border-red-100 dark:border-red-500/20 animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <div className="space-y-8">
                        {step === 1 ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wider">Gender</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {['Male', 'Female', 'Other'].map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => setGender(option)}
                                                className={`py-4 px-4 rounded-2xl text-sm font-bold border transition-all active:scale-95 ${gender === option
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                                                    : 'bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50'
                                                    }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                        Birth Date
                                    </label>
                                    <input
                                        type="date"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-900 dark:text-white transition-all placeholder:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-900/50"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Profile Image Section */}
                                    <div className="flex flex-col items-center">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Profile Photo</label>
                                        <div className="relative group">
                                            <div
                                                onClick={() => avatarInputRef.current?.click()}
                                                className="w-32 h-32 rounded-[32px] bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 transition-all group-hover:shadow-2xl group-hover:shadow-blue-500/10"
                                            >
                                                {avatarPreview ? (
                                                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-4 transition-transform group-hover:scale-110">
                                                        <Upload className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest cursor-pointer">Select</span>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => avatarInputRef.current?.click()}
                                                className="absolute -bottom-1 -right-1 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-90 border-2 border-white dark:border-zinc-950"
                                            >
                                                <Camera className="w-4 h-4" />
                                            </button>
                                            <input
                                                type="file"
                                                ref={avatarInputRef}
                                                onChange={(e) => handleImageChange(e, 'avatar')}
                                                className="hidden"
                                                accept="image/*"
                                            />
                                        </div>
                                    </div>

                                    {/* Cover Image Section */}
                                    <div className="flex flex-col items-center">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Cover Image</label>
                                        <div className="relative group">
                                            <div
                                                onClick={() => coverInputRef.current?.click()}
                                                className="w-40 h-32 rounded-[32px] bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 transition-all group-hover:shadow-2xl group-hover:shadow-blue-500/10"
                                            >
                                                {coverPreview ? (
                                                    <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-4 transition-transform group-hover:scale-110">
                                                        <Upload className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest cursor-pointer">Select</span>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => coverInputRef.current?.click()}
                                                className="absolute -bottom-1 -right-1 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-90 border-2 border-white dark:border-zinc-950"
                                            >
                                                <Camera className="w-4 h-4" />
                                            </button>
                                            <input
                                                type="file"
                                                ref={coverInputRef}
                                                onChange={(e) => handleImageChange(e, 'cover')}
                                                className="hidden"
                                                accept="image/*"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wider">Bio (Optional)</label>
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Artist, designer, dreamer..."
                                        className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-900 dark:text-white transition-all placeholder:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-900/50 min-h-[100px] resize-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 flex gap-4">
                        {step === 2 && (
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-4 px-6 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all flex items-center justify-center gap-2"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                <span>Back</span>
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            disabled={loading}
                            className={`flex-1 py-4 px-6 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-2`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <span>{step === 1 ? 'Next' : 'Complete Setup'}</span>
                                    {step === 1 ? <ChevronRight className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {showAdjustModal && adjustImage && (
                <ImageAdjustModal
                    image={adjustImage}
                    onClose={() => {
                        setShowAdjustModal(false);
                        setAdjustImage(null);
                    }}
                    onComplete={handleCropComplete}
                    cropShape={adjustType === 'avatar' ? 'round' : 'rect'}
                    aspect={adjustType === 'avatar' ? 1 : 16 / 5}
                />
            )}
        </div>
    );
}

