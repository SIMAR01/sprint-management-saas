import { NOTIFICATION_TYPES } from "../../models/notification.model";

/**
 * Reusable OpenAPI Component Schemas for Notification Inbox & Email Dispatch
 */
export const notificationSchemas = {
  NotificationType: {
    type: "string",
    enum: NOTIFICATION_TYPES,
    description: "Categorized event classification for in-app and email notifications",
    example: "TASK_STATUS_CHANGED",
  },

  NotificationItem: {
    type: "object",
    required: ["notificationId", "userId", "title", "message", "type", "isRead", "createdAt", "updatedAt"],
    properties: {
      notificationId: {
        type: "string",
        format: "uuid",
        description: "Unique notification UUID identifier",
        example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      },
      userId: {
        type: "string",
        format: "uuid",
        description: "Recipient user UUID identifier",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      projectId: {
        type: "string",
        format: "uuid",
        nullable: true,
        description: "Associated project workspace UUID",
        example: "8ea38a6a-d248-43df-973f-c399b38c2317",
      },
      taskId: {
        type: "string",
        format: "uuid",
        nullable: true,
        description: "Associated task UUID",
        example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
      },
      title: {
        type: "string",
        description: "Notification headline / subject",
        example: "Task Updated: \"Implement JWT refresh token rotation\"",
      },
      message: {
        type: "string",
        description: "Detailed notification message",
        example: "Jane Doe updated 'Implement JWT refresh token rotation' in 'Acme Workspace': status changed from 'inprogress' to 'done'.",
      },
      type: {
        $ref: "#/components/schemas/NotificationType",
      },
      data: {
        type: "object",
        description: "Metadata payload (actor details, project name, task title, diffs)",
        example: {
          projectId: "8ea38a6a-d248-43df-973f-c399b38c2317",
          projectName: "Acme Workspace",
          taskId: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
          taskTitle: "Implement JWT refresh token rotation",
          actorName: "Jane Doe",
        },
      },
      isRead: {
        type: "boolean",
        description: "Whether the notification has been read/seen by the user",
        example: false,
      },
      readAt: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "Timestamp when marked as read",
        example: null,
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T15:00:00.000Z",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T15:00:00.000Z",
      },
    },
  },

  PaginatedNotificationsData: {
    type: "object",
    required: ["notifications", "unreadCount", "pagination"],
    properties: {
      notifications: {
        type: "array",
        items: {
          $ref: "#/components/schemas/NotificationItem",
        },
      },
      unreadCount: {
        type: "integer",
        description: "Total unread notification count for the user",
        example: 3,
      },
      pagination: {
        $ref: "#/components/schemas/PaginationMeta",
      },
    },
  },

  PaginatedNotificationsResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Inbox notifications retrieved successfully",
      },
      data: {
        $ref: "#/components/schemas/PaginatedNotificationsData",
      },
    },
  },

  UnreadCountResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Unread notification count retrieved successfully",
      },
      data: {
        type: "object",
        properties: {
          unreadCount: {
            type: "integer",
            example: 5,
          },
        },
      },
    },
  },

  NotificationSuccessResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Notification marked as read",
      },
      data: {
        $ref: "#/components/schemas/NotificationItem",
      },
    },
  },

  MarkAllReadRequest: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        format: "uuid",
        description: "Optional project workspace UUID to mark only that workspace's notifications as read",
        example: "8ea38a6a-d248-43df-973f-c399b38c2317",
      },
    },
  },

  TestEmailRequest: {
    type: "object",
    required: ["to"],
    properties: {
      to: {
        type: "string",
        format: "email",
        description: "Recipient email address for test message",
        example: "developer@example.com",
      },
      subject: {
        type: "string",
        description: "Email subject line",
        example: "TeamFlow Test Notification",
      },
      message: {
        type: "string",
        description: "Test notification body message",
        example: "Testing SendGrid integration for sprint notifications.",
      },
    },
  },
};
