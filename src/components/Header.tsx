import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import logo from '../assets/logo.png';

export function Header() {
  const { profile } = useAuth();

  return (
    <header className="w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-200">
      <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Left Side: Logo and Search (Mobile Only) */}
        <div className="flex items-center gap-4">
          <Link to="/" className="md:hidden">
            <img src={logo} alt="Lookify Logo" className="w-8 h-8 object-contain" />
          </Link>
          <Link to="/search" className="md:hidden text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
            <Search className="w-6 h-6" />
          </Link>
        </div>

        {/* Right Side: Profile */}
        {profile && (
          <Link
            to="/profile"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="font-bold text-sm dark:text-gray-100">
                {profile.username}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                View Profile
              </span>
            </div>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-md translate-y-[-1px]"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-base font-bold shadow-md translate-y-[-1px]">
                {profile.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
