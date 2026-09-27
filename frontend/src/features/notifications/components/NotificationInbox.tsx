import React, { useState } from 'react';
import {
  Inbox,
  Bell,
  CheckCircle2,
  FolderKanban,
  CheckSquare,
  UserPlus,
  UserMinus,
  Trash2,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  Clock,
  Sparkles,
  Layers,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
} from 'lucide-react';
import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useClearAllNotificationsMutation,
  useDeleteNotificationMutation,
} from '../hooks/useNotificationQueries';
import { useWorkspacesQuery } from '../../projects/hooks/useProjectQueries';
import { NotificationItem, NotificationType } from '../types/notification.types';
import { NotificationDetailModal } from './NotificationDetailModal';

const NOTIFICATION_TYPE_CATEGORIES: { id: string; label: string; types?: NotificationType[] }[] = [
  { id: 'all', label: 'All Events' },
  {
    id: 'tasks',
    label: 'Tasks & Proofs',
    types: [
      'TASK_CREATED',
      'TASK_UPDATED',
      'TASK_STATUS_CHANGED',
      'TASK_ASSIGNED',
      'TASK_DELETED',
      'TASK_BULK_DELETED',
      'TASK_ATTACHMENT_ADDED',
      'TASK_ATTACHMENT_DELETED',
    ],
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    types: ['PROJECT_CREATED', 'PROJECT_ARCHIVED', 'PROJECT_DELETED'],
  },
  {
    id: 'team',
    label: 'Team Members',
    types: ['MEMBER_INVITED', 'MEMBER_REMOVED'],
  },
];

const getNotificationBadge = (type: NotificationType) => {
  switch (type) {
    case 'TASK_CREATED':
      return { label: 'Task Created', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: CheckSquare };
    case 'TASK_STATUS_CHANGED':
      return { label: 'Status Changed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 };
    case 'TASK_ASSIGNED':
      return { label: 'Task Assigned', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: UserPlus };
    case 'TASK_UPDATED':
      return { label: 'Task Updated', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20', icon: Sparkles };
    case 'TASK_DELETED':
    case 'TASK_BULK_DELETED':
      return { label: 'Task Deleted', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: Trash2 };
    case 'PROJECT_CREATED':
      return { label: 'Project Created', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20', icon: FolderKanban };
    case 'PROJECT_ARCHIVED':
    case 'PROJECT_DELETED':
      return { label: 'Project Notice', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Layers };
    case 'MEMBER_INVITED':
      return { label: 'Team Invite', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20', icon: UserPlus };
    case 'MEMBER_REMOVED':
      return { label: 'Member Removed', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: UserMinus };
    case 'TASK_ATTACHMENT_ADDED':
    case 'TASK_ATTACHMENT_DELETED':
      return { label: 'Attachment', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Sparkles };
    default:
      return { label: 'System', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Bell };
  }
};

export const NotificationInbox: React.FC = () => {
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // Convert tab to boolean for API query
  const isReadFilter =
    selectedStatusTab === 'unread' ? false : selectedStatusTab === 'read' ? true : undefined;

  const { data: workspaces = [] } = useWorkspacesQuery();
  const { data: unreadCount = 0 } = useUnreadCountQuery();

  const {
    data: inboxData,
    isLoading,
    isFetching,
    refetch,
  } = useNotificationsQuery({
    page,
    limit,
    isRead: isReadFilter,
    projectId: selectedProjectId || undefined,
  });

  const markAsReadMutation = useMarkAsReadMutation();
  const markAllAsReadMutation = useMarkAllAsReadMutation();
  const clearAllMutation = useClearAllNotificationsMutation();
  const deleteMutation = useDeleteNotificationMutation();

  const rawNotifications = inboxData?.notifications || [];
  const pagination = inboxData?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

  // Filter in-memory for category and keyword search if applicable
  const filteredNotifications = rawNotifications.filter((n) => {
    // Category filter
    if (selectedCategory !== 'all') {
      const categoryObj = NOTIFICATION_TYPE_CATEGORIES.find((c) => c.id === selectedCategory);
      if (categoryObj?.types && !categoryObj.types.includes(n.type)) {
        return false;
      }
    }

    // Keyword search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchMsg = n.message.toLowerCase().includes(q);
      const matchProject = (n.data?.projectName || '').toLowerCase().includes(q);
      const matchActor = (n.data?.actorName || n.data?.creatorName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchProject && !matchActor) {
        return false;
      }
    }

    return true;
  });

  const handleOpenDetail = (notification: NotificationItem) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.notificationId);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsReadMutation.mutate(selectedProjectId || undefined);
  };

  const handleClearRead = () => {
    if (window.confirm('Clear all read notifications from your inbox?')) {
      clearAllMutation.mutate(true);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center shadow-md shadow-brand-500/20">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <span>Notification Inbox</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time feed for task updates, workspace invitations, and activity alerts.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700/60 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleMarkAllRead}
            disabled={markAllAsReadMutation.isPending || unreadCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 active:scale-98 text-white rounded-lg text-xs font-semibold shadow-md shadow-brand-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Read</span>
          </button>

          <button
            onClick={handleClearRead}
            disabled={clearAllMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 rounded-lg text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Clear Read</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Control Bar */}
      <div className="glass-card rounded-2xl p-4 space-y-4 border border-slate-800/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs (All, Unread, Read) */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 w-fit">
            <button
              onClick={() => {
                setSelectedStatusTab('all');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatusTab === 'all'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Notifications
            </button>
            <button
              onClick={() => {
                setSelectedStatusTab('unread');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedStatusTab === 'unread'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-white/20 text-white text-[10px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setSelectedStatusTab('read');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatusTab === 'read'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Read
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, project, task, or team member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>

        {/* Secondary Filters (Category & Project Workspace) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
            <Filter className="w-3.5 h-3.5 text-brand-400" />
            <span>Filter By:</span>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {NOTIFICATION_TYPE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                  selectedCategory === cat.id
                    ? 'bg-brand-500/10 text-brand-300 border-brand-500/40'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Project Filter Dropdown */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500 text-[11px]">Workspace:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="">All Workspaces</option>
              {workspaces.map((w) => (
                <option key={w.projectId} value={w.projectId}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications Listing View */}
      <div className="glass-card rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col flex-1">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Loading inbox...
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
              <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">No notifications found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                {searchQuery || selectedCategory !== 'all' || selectedProjectId || selectedStatusTab !== 'all'
                  ? 'No notifications match your filter criteria. Try resetting filters.'
                  : 'You are all caught up! New updates from your project workspace will appear here in real time.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredNotifications.map((notification) => {
              const badge = getNotificationBadge(notification.type);
              const BadgeIcon = badge.icon;
              const metadata = notification.data || {};

              return (
                <div
                  key={notification.notificationId}
                  onClick={() => handleOpenDetail(notification)}
                  className={`p-4 sm:p-5 hover:bg-slate-900/50 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative group ${
                    !notification.isRead ? 'bg-brand-500/[0.04]' : ''
                  }`}
                >
                  {/* Left glowing dot for unread item */}
                  {!notification.isRead && (
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-pink-500"
                      title="Unread"
                    />
                  )}

                  {/* Icon & Message Container */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 mt-0.5 shadow-sm ${badge.color}`}
                    >
                      <BadgeIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>

                        {metadata.projectName && (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 flex items-center gap-1">
                            <FolderKanban className="w-3 h-3 text-brand-400" />
                            <span className="truncate max-w-[120px]">{metadata.projectName}</span>
                          </span>
                        )}

                        <span className="text-[10px] text-slate-500 flex items-center gap-1 ml-auto sm:ml-0">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span>
                            {new Date(notification.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            at{' '}
                            {new Date(notification.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </span>
                      </div>

                      <h4
                        className={`text-sm leading-snug break-words ${
                          !notification.isRead ? 'font-bold text-white' : 'font-medium text-slate-300'
                        }`}
                      >
                        {notification.title}
                      </h4>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Detail CTA */}
                  <div className="flex items-center gap-2 sm:self-center shrink-0 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(notification.notificationId);
                      }}
                      title="Delete Notification"
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(notification);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/80 group-hover:bg-brand-600 text-slate-300 group-hover:text-white text-xs font-semibold border border-slate-700 group-hover:border-brand-500 transition-all shadow-sm"
                    >
                      <span>View Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3.5 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Showing Page <span className="font-bold text-white">{pagination.page}</span> of{' '}
              <span className="font-bold text-white">{pagination.totalPages}</span> ({pagination.total} total)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Notification Detail Modal */}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
        />
      )}
    </div>
  );
};
