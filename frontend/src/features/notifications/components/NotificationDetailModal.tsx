import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Bell,
  CheckCircle2,
  FolderKanban,
  CheckSquare,
  UserPlus,
  UserMinus,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { NotificationItem, NotificationType } from '../types/notification.types';
import { useMarkAsReadMutation, useDeleteNotificationMutation } from '../hooks/useNotificationQueries';

interface NotificationDetailModalProps {
  notification: NotificationItem | null;
  onClose: () => void;
}

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
      return { label: 'Media / Attachment', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Sparkles };
    default:
      return { label: 'Notification', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Bell };
  }
};

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  onClose,
}) => {
  const navigate = useNavigate();
  const markAsReadMutation = useMarkAsReadMutation();
  const deleteMutation = useDeleteNotificationMutation();

  // Automatically mark notification as read as soon as modal opens
  useEffect(() => {
    if (notification && !notification.isRead) {
      markAsReadMutation.mutate(notification.notificationId);
    }
  }, [notification?.notificationId, notification?.isRead]);

  if (!notification) return null;

  const badge = getNotificationBadge(notification.type);
  const BadgeIcon = badge.icon;
  const metadata = notification.data || {};

  const handleNavigateToContext = () => {
    onClose();
    if (notification.projectId) {
      navigate(`/dashboard/projects/${notification.projectId}/tasks`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(notification.notificationId, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-800/80 animate-scale-in flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${badge.color}`}>
              <BadgeIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {badge.label}
              </span>
              {notification.isRead && (
                <span className="ml-2 text-[10px] text-emerald-400 font-semibold">
                  (Read)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              title="Delete Notification"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Notification Title & Full message */}
          <div>
            <h3 className="text-lg font-bold text-white mb-2 leading-snug">
              {notification.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              {notification.message}
            </p>
          </div>

          {/* Context Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Timestamp */}
            <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Received At
                </span>
                <span className="text-xs font-medium text-slate-200">
                  {new Date(notification.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>

            {/* Read status */}
            <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Seen Status
                </span>
                <span className="text-xs font-medium text-slate-200">
                  {notification.readAt
                    ? `Seen at ${new Date(notification.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Marked as read'}
                </span>
              </div>
            </div>

            {/* Project Context */}
            {(metadata.projectName || notification.projectId) && (
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-2.5">
                <FolderKanban className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <div className="truncate">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Workspace Project
                  </span>
                  <span className="text-xs font-medium text-slate-200 truncate block">
                    {metadata.projectName || notification.projectId}
                  </span>
                </div>
              </div>
            )}

            {/* Actor Information */}
            {(metadata.actorName || metadata.creatorName || metadata.inviterName) && (
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Triggered By
                  </span>
                  <span className="text-xs font-medium text-slate-200">
                    {metadata.actorName || metadata.creatorName || metadata.inviterName}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Detailed State Changes / Diffs */}
          {metadata.changesSummary && (
            <div className="p-3.5 rounded-xl bg-slate-900/30 border border-slate-800/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Summary of Changes
              </span>
              <p className="text-xs text-slate-200 font-medium capitalize">
                {metadata.changesSummary}
              </p>
            </div>
          )}

          {metadata.previousStatus && metadata.newStatus && (
            <div className="p-3.5 rounded-xl bg-slate-900/30 border border-slate-800/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Previous Status</span>
                <span className="text-xs font-semibold text-slate-300 uppercase">{metadata.previousStatus}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-brand-400" />
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">New Status</span>
                <span className="text-xs font-semibold text-emerald-400 uppercase">{metadata.newStatus}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-lg transition-colors"
          >
            Close
          </button>

          {notification.projectId && (
            <button
              onClick={handleNavigateToContext}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-tr from-brand-600 to-violet-500 hover:from-brand-500 hover:to-violet-400 active:scale-98 text-white text-xs font-semibold rounded-lg shadow-md shadow-brand-500/10 transition-all"
            >
              <span>Go to Task Board</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
