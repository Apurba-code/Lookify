import React from "react";
import { useState, useRef } from 'react';
import { Camera, User, Calendar, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type OnboardingProps = {
    onComplete: () => void;
};

export function Onboarding({ onComplete }: OnboardingProps) {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [gender, setGender] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatar(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleNext = async () => {
        setError('');

        if (step === 1) {
            if (!gender || !birthDate) {
                setError('Please fill in all fields');
                return;
            }
            // Persist basic info to DB immediately so partial completion is remembered
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

            if (avatar) {
                const fileExt = avatar.name.split('.').pop();
                const fileName = `${user.id}/${Math.random()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, avatar);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                avatarUrl = publicUrl;
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    gender,
                    birth_date: birthDate,
                    bio,
                    avatar_url: avatarUrl,
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

            onComplete();
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Progress Bar */}
                <div className="h-2 bg-gray-100">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300 ease-out"
                        style={{ width: `${(step / 2) * 100}%` }}
                    />
                </div>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">Complete Your Profile</h2>
                        <p className="text-gray-500 mt-2">
                            Step {step} of 2: {step === 1 ? 'Basic Info' : 'Profile Details'}
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center">
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['Male', 'Female', 'Other'].map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => setGender(option)}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${gender === option
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Birth Date
                                    </div>
                                </label>
                                <input
                                    type="date"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-center">
                                <div className="relative">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors"
                                    >
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <Upload className="w-8 h-8 mx-auto mb-1" />
                                                <span className="text-xs">Upload Photo</span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Bio (Optional)</label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Tell us about yourself..."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex gap-3">
                        {step === 2 && (
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            disabled={loading}
                            className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Saving...' : step === 1 ? 'Next' : 'Complete Setup'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
