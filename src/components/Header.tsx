import React from "react";
import { Camera, Home, PlusSquare, User, LogOut, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type HeaderProps = {
  currentView: 'home' | 'profile' | 'create' | 'search';
  onNavigate: (view: 'home' | 'profile' | 'create' | 'search', userId?: string) => void;
};

export function Header({ currentView, onNavigate }: HeaderProps) {
  const { signOut, profile } = useAuth();

  return (
    <header className="bg-white border-b border-gray-300 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between relative">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Camera className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 hidden sm:block">Lookify</h1>
        </button>

        <div className="hidden md:block absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              onFocus={() => onNavigate('search')}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <nav className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('home')}
            className={`hover:text-blue-600 transition-colors ${currentView === 'home' ? 'text-blue-600' : 'text-gray-700'
              }`}
          >
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={() => onNavigate('create')}
            className={`hover:text-blue-600 transition-colors ${currentView === 'create' ? 'text-blue-600' : 'text-gray-700'
              }`}
          >
            <PlusSquare className="w-6 h-6" />
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className={`hover:text-blue-600 transition-colors ${currentView === 'profile' ? 'text-blue-600' : 'text-gray-700'
              }`}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-7 h-7 rounded-full object-cover border-2 border-gray-300"
              />
            ) : (
              <User className="w-6 h-6" />
            )}
          </button>
          <button
            onClick={signOut}
            className="text-gray-700 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </nav>
      </div>
    </header>
  );
}
