import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { NotificationService } from "../services/notification.service";
import { NotificationType } from "../models/notification.model";
import { sendEmail } from "../utils/sendgrid";

export class NotificationController {
  /**
   * GET /api/v1/notifications
   *
   * Retrieves paginated inbox notifications for the authenticated user.
   * Supports filtering by isRead, type, and projectId.
   */
  public static getNotifications = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.uuid?.id;
      if (!userId) {
        throw new ApiError(401, "User session not found");
      }

      const { page, limit, isRead, type, projectId } = req.query as unknown as {
        page: number;
        limit: number;
        isRead?: boolean;
        type?: NotificationType;
        projectId?: string;
      };

      const result = await NotificationService.getUserNotifications(userId, {
        page,
        limit,
        isRead,
        type,
        projectId,
      });

      res.status(200).json(
        new ApiResponse(200, result, "Inbox notifications retrieved successfully")
      );
    }
  );

  /**
   * GET /api/v1/notifications/unread-count
   *
   * Returns current count of unread notifications for badge indicators.
   */
  public static getUnreadCount = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.uuid?.id;
      if (!userId) {
        throw new ApiError(401, "User session not found");
      }

      const result = await NotificationService.getUnreadCount(userId);

      res.status(200).json(
        new ApiResponse(200, result, "Unread notification count retrieved successfully")
      );
    }
  );

  /**
   * PATCH /api/v1/notifications/:notificationId/read
   *
   * Marks a specific notification as seen / read.
   */
  public static markAsRead = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.uuid?.id;
      if (!userId) {
        throw new ApiError(401, "User session not found");
      }

      const { notificationId } = req.params as { notificationId: string };
      const notification = await NotificationService.markAsRead(notificationId, userId);

      res.status(200).json(
        new ApiResponse(200, notification, "Notification marked as read")
      );
    }
  );

  /**
   * PATCH /api/v1/notifications/read-all
   *
   * Marks all inbox notifications (or all in a project) as read.
   */
  public static markAllAsRead = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.uuid?.id;
      if (!userId) {
        throw new ApiError(401, "User session not found");
      }

      const { projectId } = req.body as { projectId?: string };
      const result = await NotificationService.markAllAsRead(userId, projectId);

      res.status(200).json(
        new ApiResponse(200, result, "All notifications marked as read")
      );
    }
  );

  /**
   * DELETE /api/v1/notifications/:notificationId
   *
   * Deletes a single notification from the user's inbox.
   */
  public static deleteNotification = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.uuid?.id;
      if (!userId) {
        throw new ApiError(401, "User session not found");
      }

      const { notificationId } = req.params as { notificationId: string };
      await NotificationService.deleteNotification(notificationId, userId);

      res.status(200).json(
        new ApiResponse(200, null, "Notification deleted successfully")
      );
    }
  );

  /**
   * DELETE /api/v1/notifications/clear-all
   *
   * Clears all (or all read) notifications from the user's inbox.
   */
  public static clearAllNotifications = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.uuid?.id;
      if (!userId) {
        throw new ApiError(401, "User session not found");
      }

      const { readOnly } = req.query as unknown as { readOnly?: boolean };
      const result = await NotificationService.clearAllNotifications(userId, readOnly);

      res.status(200).json(
        new ApiResponse(200, result, "Notifications cleared successfully")
      );
    }
  );

  /**
   * POST /api/v1/notifications/test-email
   *
   * Dispatches a test email via SendGrid for configuration verification.
   */
  public static testSendEmail = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { to, subject, message } = req.body as {
        to: string;
        subject: string;
        message: string;
      };

      const result = await sendEmail({
        to,
        subject,
        html: `
          <div style="font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <h2 style="color: #818cf8; margin-top: 0;">TeamFlow Test Notification</h2>
            <p>${message}</p>
            <hr style="border: 1px solid #334155; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">Sent via SendGrid Email Integration on TeamFlow SaaS</p>
          </div>
        `,
        text: `${subject}\n\n${message}\n\nSent via TeamFlow SaaS`,
      });

      if (!result.success) {
        throw new ApiError(500, `SendGrid test email failed: ${result.error}`);
      }

      res.status(200).json(
        new ApiResponse(200, result, "Test email dispatched successfully via SendGrid")
      );
    }
  );
}
