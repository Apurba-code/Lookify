import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { Header } from './components/Header';
import { Feed } from './components/Feed';
import { Profile } from './components/Profile';
import { CreatePost } from './components/CreatePost';
import { Onboarding } from './components/Onboarding';
import { Search } from './components/Search';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'create' | 'search' | 'onboarding'>('home');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Check for onboarding
  useEffect(() => {
    if (user && profile && !profile.gender && !profile.birth_date && currentView !== 'onboarding') {
      setCurrentView('onboarding');
    }
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (currentView === 'onboarding') {
    return <Onboarding onComplete={() => setCurrentView('home')} />;
  }

  function handleNavigate(view: 'home' | 'profile' | 'create' | 'search', userId?: string) {
    if (view === 'create') {
      setShowCreatePost(true);
    } else {
      setCurrentView(view);
      if (userId) {
        setViewingUserId(userId);
      } else {
        setViewingUserId(null); // Reset when going to own profile via header or home
      }
    }
  }

  function handlePostSuccess() {
    setCurrentView('home');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentView={currentView} onNavigate={handleNavigate} />

      {currentView === 'home' && <Feed key={Date.now()} onNavigateToProfile={(userId) => handleNavigate('profile', userId)} />}
      {currentView === 'profile' && <Profile userId={viewingUserId || undefined} onNavigateToProfile={(userId) => handleNavigate('profile', userId)} />}
      {currentView === 'search' && <Search onNavigateToProfile={(userId) => handleNavigate('profile', userId)} />}

      {showCreatePost && (
        <CreatePost
          onClose={() => setShowCreatePost(false)}
          onSuccess={handlePostSuccess}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
