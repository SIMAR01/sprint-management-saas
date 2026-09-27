import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { SessionModal } from '../../auth/components/SessionModal';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  LogOut,
  Layers,
  Inbox,
  X,
  Bell,
  ExternalLink,
} from 'lucide-react';
import { NotificationDropdown } from '../../notifications/components/NotificationDropdown';
import {
  useNotificationSocketSync,
  useUnreadCountQuery,
} from '../../notifications/hooks/useNotificationQueries';
import { NotificationItem } from '../../notifications/types/notification.types';

export const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);

  // Initialize global Socket.IO listener for notifications
  useNotificationSocketSync();

  // Query unread count for sidebar indicator
  const { data: unreadCount = 0 } = useUnreadCountQuery();

  // Listen for custom event emitted when a new notification arrives via socket
  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationItem>;
      if (customEvent.detail) {
        setLiveToast(customEvent.detail);
        // Auto-dismiss after 6 seconds
        setTimeout(() => {
          setLiveToast((prev) =>
            prev?.notificationId === customEvent.detail.notificationId ? null : prev
          );
        }, 6000);
      }
    };

    window.addEventListener('app:notification', handleNewNotification);
    return () => {
      window.removeEventListener('app:notification', handleNewNotification);
    };
  }, []);

  const navItems = [
    {
      label: 'Workspaces',
      to: '/dashboard',
      icon: FolderKanban,
      exact: true,
    },
    {
      label: 'Notification Inbox',
      to: '/dashboard/inbox',
      icon: Inbox,
      badge: unreadCount,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Header */}
      <header className="glass-card border-x-0 border-t-0 sticky top-0 z-40 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center shadow-md shadow-brand-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              TeamFlow
            </span>
          </div>
        </div>

        {/* Right Header: Notification Bell + User Profile + Logout */}
        <div className="flex items-center gap-3.5">
          {/* Notification Bell Dropdown */}
          <NotificationDropdown />

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-200">{user?.name}</span>
            <span className="text-[10px] text-slate-400">@{user?.username}</span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-750 transition-all shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5 text-brand-400" />
            <span>Sessions</span>
          </button>
        </div>
      </header>

      {/* Live Floating In-App Notification Toast */}
      {liveToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-slide-up">
          <div className="glass-card bg-slate-900/95 border-brand-500/40 p-4 rounded-2xl shadow-2xl flex items-start gap-3 relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-pink-500" />
            <div className="p-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0 mt-0.5">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  New Alert
                </span>
                <button
                  onClick={() => setLiveToast(null)}
                  className="text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <h4 className="text-xs font-bold text-white truncate mt-0.5">{liveToast.title}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                {liveToast.message}
              </p>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setLiveToast(null);
                    navigate('/dashboard/inbox');
                  }}
                  className="text-[10px] font-bold text-brand-300 hover:underline flex items-center gap-1"
                >
                  <span>Open Inbox</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        {/* Left Sidebar: Profile Details Panel & Nav */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-5 space-y-4 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600/30 to-violet-500/30 border border-brand-500/30 flex items-center justify-center text-brand-300 text-xl font-bold font-sans">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-100 text-sm truncate">{user?.name}</h3>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>

            <hr className="border-slate-800/80" />

            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Account Details
              </p>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Username</span>
                <span className="text-brand-300 font-semibold">@{user?.username}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Role</span>
                <span className="text-slate-300 capitalize font-medium">{user?.role || 'Member'}</span>
              </div>
            </div>
          </div>

          {/* Quick Menu Nav */}
          <nav className="glass-card rounded-2xl p-3 flex flex-col gap-1.5 text-xs font-semibold border border-slate-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/projects')
                : location.pathname === item.to;

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-brand-500 to-pink-500 text-white text-[10px] font-extrabold rounded-full shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Right Content Pane: Dynamically rendered via Router Outlet */}
        <main className="flex-1 overflow-x-hidden min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Session Management Modal */}
      <SessionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
