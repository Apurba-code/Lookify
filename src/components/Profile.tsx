import { useEffect, useState, useRef } from 'react';
import { Grid, User as UserIcon, Settings, X, LogOut, QrCode, Camera, Edit3, Heart, MessageCircle, PlaySquare, Bookmark, Copy, Eye, PlayCircle } from 'lucide-react';
import { StoryViewer } from './StoryViewer';
import { ProfilePicCarousel } from './ProfilePicCarousel';
import { useParams } from 'react-router-dom';
import { supabase, Post as PostType, Profile as ProfileType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PostDetailModal } from './PostDetailModal';
import { Modal } from './Modal';
import { ThemeToggle } from './ThemeToggle';
import QRCode from 'qrcode';
import { ImageAdjustModal } from './ImageAdjustModal';

type ProfileProps = {
  userId?: string;
  onNavigateToProfile?: (userId: string) => void;
};

export function Profile({ userId: propUserId, onNavigateToProfile }: ProfileProps) {
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const { user: currentUser, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [savedPosts, setSavedPosts] = useState<PostType[]>([]);

  const [settingsActiveTab, setSettingsActiveTab] = useState<'edit' | 'notifications' | 'general'>('edit');

  // Edit Profile State
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState<Blob | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustImage, setAdjustImage] = useState<string | null>(null);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [profilePicHistory, setProfilePicHistory] = useState<{ url: string, created_at: string }[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileCarousel, setShowProfileCarousel] = useState(false);
  const [editCover, setEditCover] = useState<Blob | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState('');
  const [adjustType, setAdjustType] = useState<'avatar' | 'cover'>('avatar');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [notifications, setNotifications] = useState({
    likes: true,
    comments: true,
    followers: true,
  });

  const profileId = urlUserId || propUserId || currentUser?.id;
  const isOwnProfile = profileId === currentUser?.id;

  console.log('Profile rendering:', { urlUserId, propUserId, currentUserId: currentUser?.id, profileId, isOwnProfile });

  useEffect(() => {
    if (profileId) {
      console.log('Loading profile data for:', profileId);
      loadProfile();
      loadPosts();
      loadSavedPosts();
      loadStats();
      checkFollowing();
      loadStories();
      loadProfilePicHistory();
    } else if (currentUser === null && !loading) {
      // Not logged in and no ID in URL? Navigate to login if not already handled
      // App.tsx handles this but as a safety:
      console.log('No profileId and not logged in');
      setLoading(false);
    }
  }, [profileId, currentUser]);

  useEffect(() => {
    if (showSettingsModal && profile) {
      generateQRCode();
      setEditFullName(profile.full_name || '');
      setEditBio(profile.bio || '');
      if (profile.notification_settings) {
        setNotifications(profile.notification_settings as any);
      }
    }
  }, [showSettingsModal, profile]);

  async function handleNotificationToggle(key: keyof typeof notifications) {
    if (!profile) return;

    const newNotifications = {
      ...notifications,
      [key]: !notifications[key]
    };

    // Optimistic UI
    setNotifications(newNotifications);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_settings: newNotifications
        })
        .eq('id', profile.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating notifications:', error);
      // Rollback on error
      setNotifications(notifications);
    }
  }

  async function generateQRCode() {
    try {
      const url = `${window.location.origin} `; // In a real app, this would be a deep link to the user profile
      const qrMethod = QRCode as any; // Type assertion to bypass potential type mismatch
      const qr = await qrMethod.toDataURL(url);
      setQrCodeUrl(qr);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStories() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('user_id', profileId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setUserStories(data || []);
    } catch (error) {
      console.error('Error loading stories:', error);
    }
  }

  async function loadProfilePicHistory() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase
        .from('profile_pictures')
        .select('url, created_at')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfilePicHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  async function loadPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles!posts_user_id_fkey(*), likes(count), comments(count)')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }

  async function loadSavedPosts() {
    if (!isOwnProfile) return;
    try {
      const { data, error } = await supabase
        .from('saved_posts')
        .select('post_id, posts(id, image_url, likes(count), comments(count))')
        .eq('user_id', currentUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Transform data - ensure we only have valid post objects
      const formattedPosts = data?.map((item: any) => item.posts).filter(Boolean) || [];
      setSavedPosts(formattedPosts);
    } catch (error) {
      console.error('Error loading saved posts:', error);
    }
  }

  async function loadStats() {
    try {
      const [postsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', profileId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profileId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profileId),
      ]);

      setStats({
        postsCount: postsRes.count || 0,
        followersCount: followersRes.count || 0,
        followingCount: followingRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function checkFollowing() {
    if (!currentUser || isOwnProfile || !profileId) return;

    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profileId)
        .maybeSingle();

      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }

  async function handleFollow() {
    if (!currentUser || isOwnProfile) return;

    const previousFollowing = isFollowing;
    const previousStats = stats;

    console.log('Follow attempt', { currentUserId: currentUser?.id, profileId, previousFollowing });

    // Optimistic Update
    setIsFollowing(!previousFollowing);
    setStats(prev => ({
      ...prev,
      followersCount: previousFollowing ? Math.max(0, prev.followersCount - 1) : prev.followersCount + 1
    }));

    try {
      // Log session at time of request for debugging RLS/auth issues
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('Session at follow time', sessionData?.session);
      } catch (sessionErr) {
        console.warn('Could not fetch session before follow action', sessionErr);
      }

      if (previousFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', profileId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUser.id, following_id: profileId });
        if (error) throw error;

        // Trigger notification
        await supabase
          .from('notifications')
          .insert({
            user_id: profileId,
            sender_id: currentUser.id,
            type: 'follow'
          });
      }

      // Fetch fresh stats after a small delay to allow DB consistency
      setTimeout(() => loadStats(), 500);
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      try {
        const { data: sessionDataOnError } = await supabase.auth.getSession();
        console.error('Session on error', sessionDataOnError?.session);
      } catch (sessionErr) {
        console.warn('Could not fetch session after follow error', sessionErr);
      }
      // Rollback
      setIsFollowing(previousFollowing);
      setStats(previousStats);
      alert(`Failed to follow / unfollow: ${error.message || 'Please try again.'} `);
    }
  }

  async function handleUpdateProfile() {
    if (!currentUser) return;

    try {
      let avatarUrl = profile?.avatar_url;
      let coverUrl = profile?.cover_url;

      if (editAvatar) {
        const fileName = `${currentUser.id}/${Math.random()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, editAvatar, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
      }

      if (editCover) {
        const fileName = `${currentUser.id}/${Math.random()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('profile-covers')
          .upload(fileName, editCover, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-covers')
          .getPublicUrl(fileName);

        coverUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName,
          bio: editBio,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Add to history if new avatar
      if (editAvatar && avatarUrl) {
        await supabase.from('profile_pictures').insert({
          user_id: currentUser.id,
          url: avatarUrl
        });
        loadProfilePicHistory();
      }

      setSettingsActiveTab('general');
      loadProfile();
      setShowUpdateSuccess(true);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setAdjustImage(reader.result as string);
        setAdjustType('avatar');
        setShowAdjustModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setAdjustImage(reader.result as string);
        setAdjustType('cover');
        setShowAdjustModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    if (adjustType === 'avatar') {
      setEditAvatar(croppedBlob);
      setEditAvatarPreview(URL.createObjectURL(croppedBlob));
    } else {
      setEditCover(croppedBlob);
      setEditCoverPreview(URL.createObjectURL(croppedBlob));
      // For covers, we automatically open the settings modal to encourage saving
      setShowSettingsModal(true);
      setSettingsActiveTab('edit');
    }
    setShowAdjustModal(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32 px-4 text-center">
        <div className="w-24 h-24 mb-6 bg-gray-50 dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-full flex items-center justify-center text-gray-300 dark:text-zinc-700">
          <UserIcon className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Profile not found</h3>
        <p className="text-gray-500 dark:text-zinc-500 max-w-xs mb-8">
          The user you're looking for doesn't seem to exist or may have been deleted.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-8 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all active:scale-95"
          >
            Go Back
          </button>
          {isOwnProfile && (
            <button
              onClick={() => signOut()}
              className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-500/20 active:scale-95"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentPosts = activeTab === 'saved' ? savedPosts : posts;
  const filteredPosts = (currentPosts || []).filter((post: PostType) => {
    if (!post?.image_url) return false;
    const isVideo = typeof post.image_url === 'string' && post.image_url.match(/\.(mp4|mov|webm)$/i);
    if (activeTab === 'reels') return isVideo;
    return true;
  });

  return (
    <>
      <div className="max-w-5xl mx-auto px-0 md:px-4 py-0 md:py-8">
        {/* Cover Image Section */}
        <div className="relative w-full h-48 md:h-80 bg-gray-200 dark:bg-zinc-800 md:rounded-t-2xl overflow-hidden group">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
          )}
          {isOwnProfile && (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="absolute top-4 right-4 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white p-2 rounded-lg border border-white/20 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 z-20"
            >
              <Camera className="w-5 h-5" />
              <span className="text-sm font-semibold hidden md:inline">Edit Cover Photo</span>
            </button>
          )}
          <input
            type="file"
            ref={coverInputRef}
            onChange={handleCoverChange}
            className="hidden"
            accept="image/*"
          />
        </div>

        {/* Profile Info Block */}
        <div className="relative bg-white dark:bg-zinc-900/50 backdrop-blur-xl md:rounded-2xl shadow-xl shadow-black/5 mx-0 md:mx-4 -mt-12 md:-mt-16 z-10 border border-black/5 dark:border-white/5">
          <div className="px-6 pb-10 md:px-20 pt-2 md:pt-4">
            <div className="flex flex-col md:flex-row gap-8 md:gap-12 mb-8 items-center md:items-start text-center md:text-left">
              <div className="flex justify-center md:justify-start -mt-20 md:-mt-28">
                <div
                  className={`relative p-1 rounded-full ${userStories.length > 0 ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[3px]' : ''} cursor-pointer shadow-2xl`}
                  onClick={() => {
                    if (userStories.length > 0) {
                      setShowProfileMenu(true);
                    } else if (profile.avatar_url) {
                      setShowProfileCarousel(true);
                    }
                  }}
                >
                  <div className={`rounded-full ${userStories.length > 0 ? 'bg-white dark:bg-[#0a0a0a] p-[3px]' : 'bg-white dark:bg-zinc-900 p-[3px]'}`}>
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className="w-32 h-32 md:w-44 md:h-44 rounded-full object-cover border-4 border-white dark:border-zinc-900"
                      />
                    ) : (
                      <div className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-5xl font-bold border-4 border-white dark:border-zinc-900">
                        {profile?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>

                  {userStories.length > 0 && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#0095f6] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-[#0a0a0a]">
                      STORY
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                  <h1 className="text-3xl font-bold dark:text-white tracking-tight">{profile.username}</h1>
                  <div className="flex gap-2">
                    {isOwnProfile ? (
                      <button
                        onClick={() => setShowSettingsModal(true)}
                        className="px-6 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 font-bold rounded-xl text-sm transition-all flex items-center gap-2 dark:text-white border border-black/5 dark:border-white/5 active:scale-95"
                      >
                        <Settings className="w-4 h-4" />
                        Edit Profile
                      </button>
                    ) : (
                      <button
                        onClick={handleFollow}
                        className={`px-8 py-2 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${isFollowing
                          ? 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 shadow-none'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                          }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 md:flex md:justify-start gap-4 md:gap-12 mb-6 dark:text-gray-200 text-sm w-full max-w-[320px] md:max-w-none mx-auto md:mx-0">
                  <div className="flex flex-col items-center md:items-start gap-1">
                    <span className="font-bold text-xl md:text-2xl">{stats.postsCount}</span>
                    <span className="text-gray-500 uppercase text-[10px] tracking-widest font-bold">posts</span>
                  </div>
                  <div className="flex flex-col items-center md:items-start gap-1">
                    <span className="font-bold text-xl md:text-2xl">{stats.followersCount}</span>
                    <span className="text-gray-500 uppercase text-[10px] tracking-widest font-bold">followers</span>
                  </div>
                  <div className="flex flex-col items-center md:items-start gap-1">
                    <span className="font-bold text-xl md:text-2xl">{stats.followingCount}</span>
                    <span className="text-gray-500 uppercase text-[10px] tracking-widest font-bold">following</span>
                  </div>
                </div>

                <div>
                  <p className="font-bold text-lg mb-1 dark:text-white">{profile.full_name}</p>
                  {profile.bio && <p className="text-sm dark:text-gray-300 max-w-md mx-auto md:mx-0">{profile.bio}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 dark:border-white/10 pt-0">
              <div className="flex justify-center gap-12">
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`flex items-center gap-2 text-xs font-bold py-4 -mt-[1px] border-t-2 transition-all ${activeTab === 'posts' ? 'border-gray-900 text-gray-900 dark:text-white dark:border-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Grid className="w-4 h-4" />
                  POSTS
                </button>
                <button
                  onClick={() => setActiveTab('reels')}
                  className={`flex items-center gap-2 text-xs font-bold py-4 -mt-[1px] border-t-2 transition-all ${activeTab === 'reels' ? 'border-gray-900 text-gray-900 dark:text-white dark:border-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <PlaySquare className="w-4 h-4" />
                  REELS
                </button>
                {isOwnProfile && (
                  <button
                    onClick={() => setActiveTab('saved')}
                    className={`flex items-center gap-2 text-xs font-bold py-4 -mt-[1px] border-t-2 transition-all ${activeTab === 'saved' ? 'border-gray-900 text-gray-900 dark:text-white dark:border-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <Bookmark className="w-4 h-4" />
                    SAVED
                  </button>
                )}
              </div>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-gray-900 dark:border-gray-100 mb-4 dark:text-white">
                  {activeTab === 'reels' ? <PlaySquare className="w-8 h-8" /> : (activeTab === 'saved' ? <Bookmark className="w-8 h-8" /> : <UserIcon className="w-8 h-8" />)}
                </div>
                <p className="text-2xl font-light mb-2 dark:text-white">
                  No {activeTab === 'reels' ? 'Reels' : (activeTab === 'saved' ? 'Saved Posts' : 'Posts')} Yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-4">
                {filteredPosts.map((post) => {
                  const media = post.media || [];
                  const isVideo = (media.length > 0 ? media[0].type === 'video' : post.image_url?.match(/\.(mp4|mov|webm)$/i));
                  const displayUrl = media.length > 0 ? media[0].url : post.image_url;

                  return (
                    <div key={post.id} className="aspect-square relative group cursor-pointer overflow-hidden bg-gray-100 dark:bg-gray-800" onClick={() => setSelectedPostId(post.id)}>
                      {isVideo ? (
                        <video
                          src={displayUrl}
                          className="w-full h-full object-cover"
                          muted
                          loop
                        />
                      ) : (
                        <img
                          src={displayUrl}
                          alt="Post"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Media Indicators */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                        {media.length > 1 && (
                          <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-md text-white shadow-lg">
                            <Copy className="w-4 h-4" />
                          </div>
                        )}
                        {isVideo && (
                          <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-md text-white shadow-lg">
                            <PlaySquare className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white">
                        <div className="flex items-center gap-2">
                          <Heart className="w-6 h-6 fill-white" />
                          <span className="font-bold text-lg">{(post.likes as any)?.[0]?.count || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-6 h-6 fill-white" />
                          <span className="font-bold text-lg">{(post.comments as any)?.[0]?.count || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Modals & Overlays - Moved outside main container for guaranteed viewport centring */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
          onNavigateToProfile={onNavigateToProfile || (() => { })}
        />
      )}

      {showSettingsModal && isOwnProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col md:flex-row shadow-2xl transition-colors">
            {/* Sidebar */}
            <div className="w-full md:w-1/3 border-r border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50 md:rounded-l-xl">
              <h3 className="text-xl font-bold mb-6 px-2 dark:text-white">Settings</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setSettingsActiveTab('edit')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${settingsActiveTab === 'edit' ? 'bg-white dark:bg-gray-800 shadow-sm font-semibold text-blue-600' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Edit3 className="w-5 h-5" />
                  Edit Profile
                </button>
                <button
                  onClick={() => setSettingsActiveTab('notifications')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${settingsActiveTab === 'notifications' ? 'bg-white dark:bg-gray-800 shadow-sm font-semibold text-blue-600' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Settings className="w-5 h-5" />
                  Notifications
                </button>
                <button
                  onClick={() => setSettingsActiveTab('general')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${settingsActiveTab === 'general' ? 'bg-white dark:bg-gray-800 shadow-sm font-semibold text-blue-600' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Grid className="w-5 h-5" />
                  General
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 md:p-8">
              <div className="flex justify-end mb-4 md:hidden">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {settingsActiveTab === 'edit' && (
                /* Edit Profile Form */
                <div className="space-y-6">
                  <h4 className="text-lg font-semibold mb-4 dark:text-white">Edit Profile</h4>

                  <div className="flex items-center gap-6">
                    <div className="relative">
                      {editAvatarPreview || profile.avatar_url ? (
                        <img
                          src={editAvatarPreview || profile.avatar_url!}
                          alt="Avatar"
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
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
                    <div>
                      <p className="font-semibold dark:text-white">{profile.username}</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 text-sm font-semibold hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Change Profile Photo
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Cover Preview in Modal */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 dark:text-gray-300">Cover Photo</label>
                      <div className="relative w-full h-32 bg-gray-100 dark:bg-zinc-900 rounded-xl overflow-hidden group">
                        {editCoverPreview || profile.cover_url ? (
                          <img src={editCoverPreview || profile.cover_url || ''} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No Cover Photo
                          </div>
                        )}
                        <button
                          onClick={() => coverInputRef.current?.click()}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                        >
                          <Camera className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Full Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Bio</label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] bg-transparent dark:text-white"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        onClick={() => setSettingsActiveTab('general')}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateProfile}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settingsActiveTab === 'notifications' && (
                /* Notifications Form */
                <div className="space-y-6">
                  <h4 className="text-lg font-semibold mb-6 dark:text-white">Notification Settings</h4>
                  <div className="space-y-6">
                    {[
                      { id: 'likes', label: 'Likes', desc: 'When someone likes your post' },
                      { id: 'comments', label: 'Comments', desc: 'When someone comments on your post' },
                      { id: 'followers', label: 'New Followers', desc: 'When someone follows you' },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{item.label}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifications[item.id as keyof typeof notifications]}
                            onChange={() => handleNotificationToggle(item.id as keyof typeof notifications)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-400">Your preferences are saved automatically.</p>
                  </div>
                </div>
              )}

              {settingsActiveTab === 'general' && (
                /* General Settings */
                <div className="space-y-8">
                  <div className="flex justify-between items-start">
                    <h4 className="text-lg font-semibold dark:text-white">Account Actions</h4>
                    <button
                      onClick={() => setShowSettingsModal(false)}
                      className="hidden md:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center shadow-sm">
                    <div className="mx-auto w-40 h-40 bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-4 rounded-lg overflow-hidden">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                      ) : (
                        <QrCode className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>
                    <p className="font-semibold text-lg mb-1 dark:text-white">Your QR Code</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Scan to follow {profile.username}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Theme</span>
                      <ThemeToggle />
                    </div>

                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Log Out</span>
                      <LogOut className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showUpdateSuccess}
        onClose={() => setShowUpdateSuccess(false)}
        title="Success"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Settings className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-gray-600">Your profile has been updated successfully!</p>
          <button
            onClick={() => setShowUpdateSuccess(false)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </Modal>

      {showAdjustModal && adjustImage && (
        <ImageAdjustModal
          image={adjustImage}
          aspect={adjustType === 'avatar' ? 1 : 16 / 5}
          cropShape={adjustType === 'avatar' ? 'round' : 'rect'}
          onClose={() => {
            setShowAdjustModal(false);
            setAdjustImage(null);
          }}
          onComplete={handleCropComplete}
        />
      )}

      {showStoryViewer && userStories.length > 0 && (
        <StoryViewer
          stories={userStories}
          initialIndex={0}
          onClose={() => setShowStoryViewer(false)}
        />
      )}

      {showProfileMenu && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowProfileMenu(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-[300px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setShowProfileMenu(false); setShowStoryViewer(true); }}
              className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors border-b border-gray-100 dark:border-zinc-800 group"
            >
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                <PlayCircle className="w-6 h-6" />
              </div>
              <span className="font-bold dark:text-white">Watch Story</span>
            </button>
            <button
              onClick={() => { setShowProfileMenu(false); setShowProfileCarousel(true); }}
              className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group"
            >
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                <Eye className="w-6 h-6" />
              </div>
              <span className="font-bold dark:text-white">See Profile Picture</span>
            </button>
            <button
              onClick={() => setShowProfileMenu(false)}
              className="w-full p-4 text-sm font-semibold text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showProfileCarousel && (
        <ProfilePicCarousel
          images={profilePicHistory.length > 0 ? profilePicHistory : [{ url: profile.avatar_url || '', created_at: profile.created_at || new Date().toISOString() }]}
          onClose={() => setShowProfileCarousel(false)}
        />
      )}
    </>
  );
}
