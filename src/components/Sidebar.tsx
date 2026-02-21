import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusSquare, User, Search, Bell, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

export function Sidebar() {
    const { user, profile } = useAuth();
    const location = useLocation();
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);

    const currentPath = location.pathname;

    useEffect(() => {
        if (user) {
            fetchUnreadCounts();

            // Listen for custom refresh events
            window.addEventListener('refreshUnreadCounts', fetchUnreadCounts);

            // Real-time subscriptions for new notifications/messages
            const notifChannel = supabase.channel('sidebar-notifs')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, () => fetchUnreadCounts())
                .subscribe();

            const msgChannel = supabase.channel('sidebar-msgs')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`
                }, () => fetchUnreadCounts())
                .subscribe();

            const interval = setInterval(fetchUnreadCounts, 30000); // Polling for simplicity
            return () => {
                clearInterval(interval);
                window.removeEventListener('refreshUnreadCounts', fetchUnreadCounts);
                supabase.removeChannel(notifChannel);
                supabase.removeChannel(msgChannel);
            };
        }
    }, [user, currentPath]);

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
        { path: '/', icon: Home, label: 'Home' },
        { path: '/search', icon: Search, label: 'Search' },
        { path: '/create', icon: PlusSquare, label: 'Create' },
        { path: '/notifications', icon: Bell, label: 'Notifications', count: unreadNotifications },
        { path: '/inbox', icon: Send, label: 'Messages', count: unreadMessages },
        { path: '/profile', icon: User, label: 'Profile', isProfile: true },
    ];

    const isActive = (path: string) => {
        if (path === '/' && currentPath === '/') return true;
        if (path !== '/' && currentPath.startsWith(path)) return true;
        return false;
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-20 hover:w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-all duration-300 z-50 overflow-hidden group">
                <Link
                    to="/"
                    className="mb-10 px-2 flex items-center gap-4 hover:opacity-80 transition-opacity w-full text-left"
                >
                    <img src={logo} alt="Lookify Logo" className="w-8 h-8 object-contain flex-shrink-0" />
                    <h1 className="text-2xl font-bold font-heading bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Lookify</h1>
                </Link>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all relative ${isActive(item.path)
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                        >
                            <div className="flex-shrink-0 relative">
                                {item.isProfile && profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Profile" className={`w-6 h-6 rounded-full object-cover border ${isActive(item.path) ? 'border-blue-600' : 'border-transparent'}`} />
                                ) : (
                                    <item.icon className={`w-6 h-6 ${isActive(item.path) && item.path === '/notifications' ? 'fill-red-500 text-red-500' : ''}`} />
                                )}
                                {item.count !== undefined && item.count > 0 && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                                )}
                            </div>
                            <span className={`font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${isActive(item.path) ? 'text-blue-600' : ''} opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto`}>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Mobile Bottom Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-around items-center p-2 z-50 transition-colors">
                {[
                    navItems.find(i => i.path === '/'),
                    navItems.find(i => i.path === '/notifications'),
                    navItems.find(i => i.path === '/create'),
                    navItems.find(i => i.path === '/inbox'),
                    navItems.find(i => i.path === '/profile'),
                ].filter((item): item is typeof navItems[0] => !!item).map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`p-3 rounded-lg relative transition-colors ${isActive(item.path) ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400'
                            }`}
                    >
                        {item.isProfile && profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className={`w-6 h-6 rounded-full object-cover border ${isActive(item.path) ? 'border-blue-600' : 'border-transparent'}`} />
                        ) : (
                            <item.icon className={`w-6 h-6 ${isActive(item.path) && item.path === '/notifications' ? 'fill-red-500 text-red-500' : ''}`} />
                        )}
                        {item.count !== undefined && item.count > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                        )}
                    </Link>
                ))}
            </nav>
        </>
    );
}
