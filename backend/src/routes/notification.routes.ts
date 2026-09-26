import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { NotificationController } from "../controllers/notification.controller";
import {
  getNotificationsQuerySchema,
  markNotificationReadSchema,
  markAllReadSchema,
  deleteNotificationSchema,
  clearAllNotificationsSchema,
  testEmailSchema,
} from "../validations/notification.validation";

const router = Router();

// ─── Static Segment Routes ───────────────────────────────────────────────────

// GET /api/v1/notifications/unread-count (Unread count for header badges)
router.get("/unread-count", NotificationController.getUnreadCount);

// PATCH /api/v1/notifications/read-all (Mark all notifications as read)
router.patch("/read-all", validate(markAllReadSchema), NotificationController.markAllAsRead);

// DELETE /api/v1/notifications/clear-all (Clear all inbox notifications)
router.delete("/clear-all", validate(clearAllNotificationsSchema), NotificationController.clearAllNotifications);

// POST /api/v1/notifications/test-email (Test SendGrid email connection)
router.post("/test-email", validate(testEmailSchema), NotificationController.testSendEmail);

// ─── Paginated Inbox Listing ─────────────────────────────────────────────────

// GET /api/v1/notifications (Paginated notification inbox)
router.get("/", validate(getNotificationsQuerySchema), NotificationController.getNotifications);

// ─── Param Segment Routes ────────────────────────────────────────────────────

// PATCH /api/v1/notifications/:notificationId/read (Mark single notification as read)
router.patch("/:notificationId/read", validate(markNotificationReadSchema), NotificationController.markAsRead);

// DELETE /api/v1/notifications/:notificationId (Delete single notification)
router.delete("/:notificationId", validate(deleteNotificationSchema), NotificationController.deleteNotification);

export default router;
