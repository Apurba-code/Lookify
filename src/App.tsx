import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { Header } from './components/Header';
import { Feed } from './components/Feed';
import { Profile } from './components/Profile';
import { CreatePost } from './components/CreatePost';
import { Onboarding } from './components/Onboarding';
import { Search } from './components/Search';
import { Notifications } from './components/Notifications';
import { Messages } from './components/Messages';
import { Sidebar } from './components/Sidebar';

import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'create' | 'search' | 'onboarding' | 'notifications' | 'messages'>('home');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Check for onboarding
  useEffect(() => {
    if (user && profile && !profile.gender && !profile.birth_date && currentView === 'home') {
      setCurrentView('onboarding');
    }
  }, [user, profile, currentView === 'home']);

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

  function handleNavigate(view: 'home' | 'profile' | 'create' | 'search' | 'notifications' | 'messages', userId?: string) {
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
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-200">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} />

      <div className="md:ml-20 pb-20 md:pb-0">
        <Header currentView={currentView} onNavigate={handleNavigate} />

        <main className="max-w-4xl mx-auto px-0 sm:px-4">
          {currentView === 'home' && <Feed onNavigateToProfile={(userId) => handleNavigate('profile', userId)} />}
          {currentView === 'profile' && <Profile userId={viewingUserId || undefined} onNavigateToProfile={(userId) => handleNavigate('profile', userId)} />}
          {currentView === 'search' && <Search onNavigateToProfile={(userId) => handleNavigate('profile', userId)} />}
          {currentView === 'notifications' && <Notifications onNavigateToProfile={(userId) => handleNavigate('profile', userId)} onBack={() => setCurrentView('home')} />}
          {currentView === 'messages' && <Messages onBack={() => setCurrentView('home')} onNavigateToProfile={(userId) => handleNavigate('profile', userId)} />}
        </main>
      </div>

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
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
