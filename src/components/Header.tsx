import React, { useState, useEffect } from "react";
import { Home, PlusSquare, User, LogOut, Search, Heart, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import logo from '../assets/logo.png';
import { supabase } from '../lib/supabase';

type HeaderProps = {
  currentView: 'home' | 'profile' | 'create' | 'search' | 'notifications' | 'messages';
  onNavigate: (view: 'home' | 'profile' | 'create' | 'search' | 'notifications' | 'messages', userId?: string) => void;
};

export function Header({ currentView, onNavigate }: HeaderProps) {
  const { user, signOut, profile } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCounts();
      const interval = setInterval(fetchUnreadCounts, 30000); // Polling for simplicity
      return () => clearInterval(interval);
    }
  }, [user]);

  async function fetchUnreadCounts() {
    try {
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user?.id)
        .eq('is_read', false);

      setUnreadNotifications(notifCount || 0);
      setUnreadMessages(msgCount || 0);
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  }

  return (
    <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between relative">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity md:hidden"
        >
          <img src={logo} alt="Lookify Logo" className="w-8 h-8 object-contain" />
          <h1 className="text-xl font-bold font-heading bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Lookify</h1>
        </button>

        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-xs px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              onFocus={() => onNavigate('search')}
              className="w-full pl-10 pr-4 py-1.5 bg-gray-100 dark:bg-gray-700/50 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-gray-100 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={signOut}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
