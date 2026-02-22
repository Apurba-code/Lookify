import { useEffect, useState, useRef } from 'react';
import { Grid, User as UserIcon, Settings, X, LogOut, QrCode, Camera, Edit3, Heart, MessageCircle, PlaySquare, Bookmark } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase, Post as PostType, Profile as ProfileType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PostDetailModal } from './PostDetailModal';
import { Modal } from './Modal';
import { ThemeToggle } from './ThemeToggle';
import QRCode from 'qrcode';

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
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      if (editAvatar) {
        const fileExt = editAvatar.name.split('.').pop();
        const fileName = `${currentUser.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars') // Ensure this bucket exists or use 'posts' if reusing
          .upload(fileName, editAvatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName,
          bio: editBio,
          avatar_url: avatarUrl,
        })
        .eq('id', currentUser.id);

      if (error) throw error;

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
      setEditAvatar(file);
      setEditAvatarPreview(URL.createObjectURL(file));
    }
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
      <div className="text-center py-24">
        <p className="text-gray-500 text-lg">Profile not found</p>
        <p className="text-gray-400 text-sm mt-2">The user you're looking for doesn't seem to exist.</p>
      </div>
    );
  }

  const currentPosts = activeTab === 'saved' ? savedPosts : posts;
  const filteredPosts = (currentPosts || []).filter(post => {
    if (!post?.image_url) return false;
    const isVideo = typeof post.image_url === 'string' && post.image_url.match(/\.(mp4|mov|webm)$/i);
    if (activeTab === 'reels') return isVideo;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 mb-12">
        <div className="flex justify-center md:justify-start">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover"
            />
          ) : (
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-5xl font-bold">
              {profile?.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-2xl font-light dark:text-white">{profile.username}</h1>
            {isOwnProfile ? (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center dark:text-white"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={handleFollow}
                className={`px-6 py-1.5 rounded-lg font-semibold text-sm transition-colors ${isFollowing
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          <div className="flex gap-8 mb-6 dark:text-gray-200">
            <div className="text-center sm:text-left">
              <span className="font-semibold">{stats.postsCount}</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">posts</span>
            </div>
            <div className="text-center sm:text-left">
              <span className="font-semibold">{stats.followersCount}</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">followers</span>
            </div>
            <div className="text-center sm:text-left">
              <span className="font-semibold">{stats.followingCount}</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">following</span>
            </div>
          </div>

          <div>
            <p className="font-semibold mb-1 dark:text-white">{profile.full_name}</p>
            {profile.bio && <p className="text-sm whitespace-pre-wrap dark:text-gray-300">{profile.bio}</p>}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-300 dark:border-gray-700 mb-8">
        <div className="flex justify-center gap-12">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 text-xs font-semibold pt-4 -mt-[2px] border-t-2 transition-colors ${activeTab === 'posts' ? 'border-gray-900 text-gray-900 dark:text-white dark:border-white' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <Grid className="w-4 h-4" />
            POSTS
          </button>
          <button
            onClick={() => setActiveTab('reels')}
            className={`flex items-center gap-2 text-xs font-semibold pt-4 -mt-[2px] border-t-2 transition-colors ${activeTab === 'reels' ? 'border-gray-900 text-gray-900 dark:text-white dark:border-white' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <PlaySquare className="w-4 h-4" />
            REELS
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 text-xs font-semibold pt-4 -mt-[2px] border-t-2 transition-colors ${activeTab === 'saved' ? 'border-gray-900 text-gray-900 dark:text-white dark:border-white' : 'border-transparent text-gray-500 hover:text-gray-700'
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
          {filteredPosts.map((post) => (
            <div key={post.id} className="aspect-square relative group cursor-pointer overflow-hidden bg-gray-100 dark:bg-gray-800" onClick={() => setSelectedPostId(post.id)}>
              {post.image_url.match(/\.(mp4|mov|webm)$/i) ? (
                <video
                  src={post.image_url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                />
              ) : (
                <img
                  src={post.image_url}
                  alt="Post"
                  className="w-full h-full object-cover"
                />
              )}
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
          ))}
        </div>
      )}

      {
        selectedPostId && (
          <PostDetailModal
            postId={selectedPostId}
            onClose={() => setSelectedPostId(null)}
            onNavigateToProfile={onNavigateToProfile || (() => { })}
          />
        )
      }

      {
        showSettingsModal && isOwnProfile && (
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
        )
      }

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
    </div>
  );
}
