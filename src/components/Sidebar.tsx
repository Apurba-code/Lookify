import React, { useState, useEffect } from "react";
import { Home, PlusSquare, User, Search, Bell, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type SidebarProps = {
    currentView: 'home' | 'profile' | 'create' | 'search' | 'notifications' | 'messages';
    onNavigate: (view: 'home' | 'profile' | 'create' | 'search' | 'notifications' | 'messages', userId?: string) => void;
};

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
    const { user, profile } = useAuth();
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

    const navItems = [
        { id: 'home', icon: Home, label: 'Home' },
        { id: 'search', icon: Search, label: 'Search' },
        { id: 'create', icon: PlusSquare, label: 'Create' },
        { id: 'notifications', icon: Bell, label: 'Notifications', count: unreadNotifications },
        { id: 'messages', icon: Send, label: 'Messages', count: unreadMessages },
        { id: 'profile', icon: User, label: 'Profile', isProfile: true },
    ];

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-20 hover:w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-all duration-300 z-50 overflow-hidden group">
                <div className="mb-10 px-2 flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold italic text-xl">L</span>
                    </div>
                    <h1 className="text-2xl font-bold font-heading bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Lookify</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id as any)}
                            className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all relative ${currentView === item.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                        >
                            <div className="flex-shrink-0 relative">
                                {item.isProfile && profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Profile" className={`w-6 h-6 rounded-full object-cover border ${currentView === 'profile' ? 'border-blue-600' : 'border-transparent'}`} />
                                ) : (
                                    <item.icon className={`w-6 h-6 ${currentView === item.id && item.id === 'notifications' ? 'fill-red-500 text-red-500' : ''}`} />
                                )}
                                {item.count !== undefined && item.count > 0 && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                                )}
                            </div>
                            <span className={`font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${currentView === item.id ? 'text-blue-600' : ''} opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto`}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Mobile Bottom Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-around items-center p-2 z-50 transition-colors">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id as any)}
                        className={`p-3 rounded-lg relative transition-colors ${currentView === item.id ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400'
                            }`}
                    >
                        {item.isProfile && profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className={`w-6 h-6 rounded-full object-cover border ${currentView === 'profile' ? 'border-blue-600' : 'border-transparent'}`} />
                        ) : (
                            <item.icon className={`w-6 h-6 ${currentView === item.id && item.id === 'notifications' ? 'fill-red-500 text-red-500' : ''}`} />
                        )}
                        {item.count !== undefined && item.count > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                        )}
                    </button>
                ))}
            </nav>
        </>
    );
}
