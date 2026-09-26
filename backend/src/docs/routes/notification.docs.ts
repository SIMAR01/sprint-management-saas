/**
 * OpenAPI 3.0 Path Definitions for Notification Inbox & Email Dispatch Endpoints
 */
export const notificationDocs = {
  "/api/v1/notifications": {
    get: {
      tags: ["Notifications"],
      summary: "Get paginated notification inbox",
      description:
        "Retrieves a paginated list of in-app notifications for the authenticated user. Supports filtering by read status (seen/unseen), event category type, and project workspace UUID.",
      operationId: "getUserNotifications",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
          description: "Page number",
          example: 1,
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          description: "Records per page",
          example: 20,
        },
        {
          name: "isRead",
          in: "query",
          required: false,
          schema: {
            type: "boolean",
          },
          description: "Filter by seen/unseen status (true = seen, false = unseen)",
          example: false,
        },
        {
          name: "type",
          in: "query",
          required: false,
          schema: {
            $ref: "#/components/schemas/NotificationType",
          },
          description: "Filter by event category type",
          example: "TASK_STATUS_CHANGED",
        },
        {
          name: "projectId",
          in: "query",
          required: false,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Filter by associated project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
      ],
      responses: {
        200: {
          description: "Inbox notifications retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PaginatedNotificationsResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/notifications/unread-count": {
    get: {
      tags: ["Notifications"],
      summary: "Get unread notification count",
      description:
        "Returns the total number of unread/unseen notifications for the authenticated user — suitable for header/sidebar badges.",
      operationId: "getUnreadNotificationCount",
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: "Unread notification count retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UnreadCountResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/notifications/{notificationId}/read": {
    patch: {
      tags: ["Notifications"],
      summary: "Mark notification as read",
      description:
        "Marks a specific notification as seen/read by setting `isRead: true` and timestamping `readAt`.",
      operationId: "markNotificationAsRead",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "notificationId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique notification UUID",
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        },
      ],
      responses: {
        200: {
          description: "Notification marked as read",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/NotificationSuccessResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/notifications/read-all": {
    patch: {
      tags: ["Notifications"],
      summary: "Mark all notifications as read",
      description:
        "Marks all notifications (or optionally all notifications in a specific project) as seen/read for the authenticated user.",
      operationId: "markAllNotificationsAsRead",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/MarkAllReadRequest",
            },
            example: {
              projectId: "8ea38a6a-d248-43df-973f-c399b38c2317",
            },
          },
        },
      },
      responses: {
        200: {
          description: "All notifications marked as read",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  statusCode: { type: "integer", example: 200 },
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "All notifications marked as read" },
                  data: {
                    type: "object",
                    properties: {
                      updatedCount: { type: "integer", example: 12 },
                      unreadCount: { type: "integer", example: 0 },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/notifications/{notificationId}": {
    delete: {
      tags: ["Notifications"],
      summary: "Delete a notification",
      description:
        "Permanently removes a single notification item from the user's inbox.",
      operationId: "deleteNotification",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "notificationId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique notification UUID",
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        },
      ],
      responses: {
        200: {
          description: "Notification deleted successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  statusCode: { type: "integer", example: 200 },
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Notification deleted successfully" },
                  data: { type: "null", example: null },
                },
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/notifications/clear-all": {
    delete: {
      tags: ["Notifications"],
      summary: "Clear all inbox notifications",
      description:
        "Clears all notifications for the authenticated user (supports `readOnly=true` query param to purge only read items).",
      operationId: "clearAllNotifications",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "readOnly",
          in: "query",
          required: false,
          schema: {
            type: "boolean",
            default: false,
          },
          description: "Set to true to delete only read notifications and keep unread items",
          example: true,
        },
      ],
      responses: {
        200: {
          description: "Notifications cleared successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  statusCode: { type: "integer", example: 200 },
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Notifications cleared successfully" },
                  data: {
                    type: "object",
                    properties: {
                      deletedCount: { type: "integer", example: 25 },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/notifications/test-email": {
    post: {
      tags: ["Notifications"],
      summary: "Test SendGrid email integration",
      description:
        "Sends a test email via SendGrid to verify API credentials and HTML template delivery.",
      operationId: "testSendGridEmail",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/TestEmailRequest",
            },
            example: {
              to: "developer@example.com",
              subject: "TeamFlow SendGrid Verification",
              message: "Testing SendGrid HTML notifications integration.",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Test email dispatched successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  statusCode: { type: "integer", example: 200 },
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Test email dispatched successfully via SendGrid" },
                  data: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      statusCode: { type: "integer", example: 202 },
                      recipientCount: { type: "integer", example: 1 },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          $ref: "#/components/responses/BadRequest",
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },
};
