import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { axiosClient, getAccessToken } from '../../../api/axiosClient';
import { useAuth } from '../../../context/AuthContext';
import {
  NotificationItem,
  NotificationFilterParams,
  PaginatedNotificationsResponse,
  UnreadCountResponse,
} from '../types/notification.types';

// ─── QUERIES ─────────────────────────────────────────────────────────────────

/**
 * Hook to retrieve current count of unread notifications for badge indicators.
 */
export const useUnreadCountQuery = () => {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const response = await axiosClient.get<UnreadCountResponse>('/notifications/unread-count');
      return response.data.data.unreadCount;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds fresh
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to retrieve paginated notifications with dynamic filters.
 */
export const useNotificationsQuery = (filters: NotificationFilterParams = {}) => {
  const { page = 1, limit = 20, isRead, type, projectId } = filters;
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['notifications', 'list', { page, limit, isRead, type, projectId }],
    queryFn: async () => {
      const params: Record<string, any> = { page, limit };
      if (typeof isRead === 'boolean') params.isRead = isRead;
      if (type && type !== 'all') params.type = type;
      if (projectId) params.projectId = projectId;

      const response = await axiosClient.get<PaginatedNotificationsResponse>('/notifications', {
        params,
      });
      return response.data.data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 15,
  });
};

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

/**
 * Mutation to mark a single notification as read/seen with optimistic UI update.
 */
export const useMarkAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await axiosClient.patch<{
        statusCode: number;
        data: NotificationItem;
        message: string;
      }>(`/notifications/${notificationId}/read`);
      return response.data.data;
    },
    onMutate: async (notificationId) => {
      // Cancel ongoing notification list and count queries
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Optimistically decrement unread count
      queryClient.setQueryData<number>(['notifications', 'unread-count'], (old) => {
        if (old === undefined || old <= 0) return 0;
        return old - 1;
      });

      // Optimistically update isRead in cached notification list queries
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          unreadCount: Math.max(0, (old.unreadCount || 1) - 1),
          notifications: old.notifications.map((n: NotificationItem) =>
            n.notificationId === notificationId
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          ),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

/**
 * Mutation to mark all notifications as read with instant optimistic UI update.
 */
export const useMarkAllAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<{ updatedCount: number; unreadCount: number }, Error, string | undefined | void>({
    mutationFn: async (projectId?: string | void) => {
      const response = await axiosClient.patch<{
        statusCode: number;
        data: { updatedCount: number; unreadCount: number };
        message: string;
      }>('/notifications/read-all', projectId ? { projectId } : {});
      return response.data.data;
    },
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Reset unread count to 0 (or decrement)
      queryClient.setQueryData<number>(['notifications', 'unread-count'], 0);

      // Optimistically mark all cached notifications as read
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          unreadCount: 0,
          notifications: old.notifications.map((n: NotificationItem) => {
            if (projectId && n.projectId !== projectId) return n;
            return { ...n, isRead: true, readAt: new Date().toISOString() };
          }),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

/**
 * Mutation to delete a single notification item from inbox.
 */
export const useDeleteNotificationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await axiosClient.delete<{
        statusCode: number;
        data: null;
        message: string;
      }>(`/notifications/${notificationId}`);
      return response.data;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        const target = old.notifications.find((n: NotificationItem) => n.notificationId === notificationId);
        const unreadDecr = target && !target.isRead ? 1 : 0;

        if (unreadDecr > 0) {
          queryClient.setQueryData<number>(['notifications', 'unread-count'], (c) => Math.max(0, (c || 1) - 1));
        }

        return {
          ...old,
          unreadCount: Math.max(0, (old.unreadCount || 0) - unreadDecr),
          notifications: old.notifications.filter((n: NotificationItem) => n.notificationId !== notificationId),
          pagination: {
            ...old.pagination,
            total: Math.max(0, (old.pagination?.total || 1) - 1),
          },
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

/**
 * Mutation to clear all inbox notifications.
 */
export const useClearAllNotificationsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<{ deletedCount: number }, Error, boolean | undefined | void>({
    mutationFn: async (readOnly: boolean | void = false) => {
      const response = await axiosClient.delete<{
        statusCode: number;
        data: { deletedCount: number };
        message: string;
      }>('/notifications/clear-all', {
        params: { readOnly: !!readOnly },
      });
      return response.data.data;
    },
    onMutate: async (readOnly) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      if (!readOnly) {
        queryClient.setQueryData<number>(['notifications', 'unread-count'], 0);
      }

      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          unreadCount: readOnly ? old.unreadCount : 0,
          notifications: readOnly
            ? old.notifications.filter((n: NotificationItem) => !n.isRead)
            : [],
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// ─── SOCKET REAL-TIME LISTENER ───────────────────────────────────────────────

/**
 * Central Hook to synchronize User-specific Socket.IO notification events directly
 * with TanStack Query Cache and desktop/in-app alert triggers.
 */
export const useNotificationSocketSync = () => {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !isAuthenticated || !user) return;

    const socketUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1')
      .replace('/api/v1', '');

    const socket = io(socketUrl, {
      auth: { token },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // User is automatically joined to user:${userId} on backend
    });

    // 1. New incoming real-time notification
    socket.on('notification:new', (newNotif: NotificationItem) => {
      // Increment unread badge count
      queryClient.setQueryData<number>(['notifications', 'unread-count'], (old) => (old || 0) + 1);

      // Prepend to active notification list queries
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        if (old.notifications.some((n: NotificationItem) => n.notificationId === newNotif.notificationId)) {
          return old;
        }
        return {
          ...old,
          unreadCount: (old.unreadCount || 0) + 1,
          notifications: [
            { ...newNotif, isRead: false },
            ...old.notifications,
          ],
          pagination: {
            ...old.pagination,
            total: (old.pagination?.total || 0) + 1,
          },
        };
      });

      // Dispatch browser custom event for in-app floating banner/toast
      window.dispatchEvent(
        new CustomEvent('app:notification', {
          detail: newNotif,
        })
      );
    });

    // 2. Notification marked as read from another session/tab
    socket.on('notification:read', (data: { notificationId: string; unreadCount: number }) => {
      queryClient.setQueryData<number>(['notifications', 'unread-count'], data.unreadCount);
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          unreadCount: data.unreadCount,
          notifications: old.notifications.map((n: NotificationItem) =>
            n.notificationId === data.notificationId ? { ...n, isRead: true } : n
          ),
        };
      });
    });

    // 3. All notifications marked as read
    socket.on('notification:read_all', (data: { updatedCount: number; unreadCount: number }) => {
      queryClient.setQueryData<number>(['notifications', 'unread-count'], data.unreadCount);
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          unreadCount: data.unreadCount,
          notifications: old.notifications.map((n: NotificationItem) => ({ ...n, isRead: true })),
        };
      });
    });

    // 4. Notification deleted
    socket.on('notification:deleted', (data: { notificationId: string; unreadCount: number }) => {
      queryClient.setQueryData<number>(['notifications', 'unread-count'], data.unreadCount);
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          unreadCount: data.unreadCount,
          notifications: old.notifications.filter((n: NotificationItem) => n.notificationId !== data.notificationId),
        };
      });
    });

    // 5. Notifications cleared
    socket.on('notification:cleared', (data: { deletedCount: number; unreadCount: number }) => {
      queryClient.setQueryData<number>(['notifications', 'unread-count'], data.unreadCount);
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id, queryClient]);

  return socketRef.current;
};
