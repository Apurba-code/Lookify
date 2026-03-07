import { useEffect } from 'react';
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

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for onboarding
  useEffect(() => {
    if (!loading && user && location.pathname === '/') {
      // Only force onboarding if on home page and info is missing
      if (!profile || !profile.gender || !profile.birth_date) {
        navigate('/onboarding');
      }
    }
  }, [user, profile, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (user && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  const isAuthPage = location.pathname === '/login' || location.pathname === '/onboarding';

  return (
    <div className={`${isAuthPage ? 'h-screen h-[100dvh] overflow-hidden' : 'min-h-screen'} transition-colors duration-200 ${isAuthPage ? 'bg-white text-gray-900' : 'bg-white dark:bg-gray-950 dark:text-gray-100'}`}>
      {user && location.pathname !== '/login' && location.pathname !== '/onboarding' && (
        <Sidebar />
      )}

      <div className={`${user && !isAuthPage ? 'md:pl-20' : ''} ${!isAuthPage ? 'pb-20 md:pb-0' : ''}`}>
        {user && location.pathname !== '/login' && location.pathname !== '/onboarding' && (
          <Header />
        )}

        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding onComplete={() => navigate('/')} />} />

          <Route element={
            <main className="max-w-4xl mx-auto px-0 sm:px-4">
              <Routes>
                <Route path="/" element={<Feed onNavigateToProfile={(userId: string) => navigate(`/profile/${userId}`)} />} />
                <Route path="/search" element={<Search onNavigateToProfile={(userId: string) => navigate(`/profile/${userId}`)} />} />
                <Route path="/notifications" element={<Notifications onNavigateToProfile={(userId: string) => navigate(`/profile/${userId}`)} onBack={() => navigate(-1)} />} />
                <Route path="/inbox" element={<Messages onBack={() => navigate(-1)} onNavigateToProfile={(userId: string) => navigate(`/profile/${userId}`)} />} />
                <Route path="/profile" element={<Profile onNavigateToProfile={(userId: string) => navigate(`/profile/${userId}`)} />} />
                <Route path="/profile/:userId" element={<Profile onNavigateToProfile={(userId: string) => navigate(`/profile/${userId}`)} />} />

                <Route path="/create" element={
                  <CreatePost
                    onClose={() => navigate(-1)}
                    onSuccess={() => navigate('/')}
                  />
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          }>
            <Route path="/*" />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
