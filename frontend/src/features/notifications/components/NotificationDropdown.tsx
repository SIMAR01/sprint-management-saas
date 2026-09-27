import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  FolderKanban,
  CheckSquare,
  UserPlus,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  useUnreadCountQuery,
  useNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '../hooks/useNotificationQueries';
import { NotificationItem, NotificationType } from '../types/notification.types';
import { NotificationDetailModal } from './NotificationDetailModal';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'TASK_CREATED':
      return <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />;
    case 'TASK_STATUS_CHANGED':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'TASK_ASSIGNED':
      return <UserPlus className="w-3.5 h-3.5 text-purple-400" />;
    case 'PROJECT_CREATED':
      return <FolderKanban className="w-3.5 h-3.5 text-sky-400" />;
    case 'MEMBER_INVITED':
      return <UserPlus className="w-3.5 h-3.5 text-teal-400" />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-brand-400" />;
  }
};

const formatTimeAgo = (dateStr: string) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const NotificationDropdown: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadCountQuery();
  const { data: inboxData, isLoading } = useNotificationsQuery({ page: 1, limit: 6 });
  const markAsReadMutation = useMarkAsReadMutation();
  const markAllAsReadMutation = useMarkAllAsReadMutation();

  const notifications = inboxData?.notifications || [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: NotificationItem) => {
    setSelectedNotification(notification);
    setIsOpen(false);
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.notificationId);
    }
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllAsReadMutation.mutate(undefined);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-750 text-slate-200 hover:text-white transition-all shadow-sm"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-brand-500 to-pink-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-lg shadow-brand-500/40 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl glass-card border border-slate-800 shadow-2xl z-50 overflow-hidden animate-scale-in">
          {/* Top Header */}
          <div className="px-4 py-3 bg-slate-900/70 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-brand-500/20 text-brand-300 font-bold px-2 py-0.5 rounded-full border border-brand-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllAsReadMutation.isPending}
                className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List of Recent Items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-2 text-slate-500">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-slate-400">Your inbox is clear</p>
                <p className="text-[10px] text-slate-500 mt-0.5">No notifications right now</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notificationId}
                  // onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 hover:bg-slate-800/50 transition-colors cursor-pointer flex items-start gap-3 relative group ${!n.isRead ? 'bg-brand-500/[0.03]' : ''
                    }`}
                >
                  {/* Unread indicator dot */}
                  {!n.isRead && (
                    <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-brand-400" />
                  )}

                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-750 shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs truncate ${!n.isRead ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                        {n.title}
                      </p>
                      <span className="text-[9px] text-slate-500 whitespace-nowrap shrink-0">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Footer */}
          <div className="p-2.5 bg-slate-900/70 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/dashboard/inbox');
              }}
              className="w-full py-1.5 text-center text-brand-300 hover:text-brand-200 font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-800/40 rounded-lg transition-colors"
            >
              <span>Go to Full Notification Inbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
        />
      )}
    </div>
  );
};
