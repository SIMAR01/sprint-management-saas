export type NotificationType =
  | 'PROJECT_CREATED'
  | 'PROJECT_ARCHIVED'
  | 'PROJECT_DELETED'
  | 'MEMBER_INVITED'
  | 'MEMBER_REMOVED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_ASSIGNED'
  | 'TASK_DELETED'
  | 'TASK_BULK_DELETED'
  | 'TASK_ATTACHMENT_ADDED'
  | 'TASK_ATTACHMENT_DELETED';

export interface NotificationItem {
  notificationId: string;
  userId: string;
  projectId?: string | null;
  taskId?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  data: Record<string, any>;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedNotificationsResponse {
  statusCode: number;
  data: {
    notifications: NotificationItem[];
    unreadCount: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message: string;
  success: boolean;
}

export interface UnreadCountResponse {
  statusCode: number;
  data: {
    unreadCount: number;
  };
  message: string;
  success: boolean;
}

export interface NotificationFilterParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType | 'all';
  projectId?: string;
}
