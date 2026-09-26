import { z } from "zod";
import { NOTIFICATION_TYPES } from "../models/notification.model";

// ─── Reusable Notification Type Enum ──────────────────────────────────────────

const notificationTypeEnum = z.enum(
  NOTIFICATION_TYPES as [string, ...string[]],
  { message: `Type must be one of: ${NOTIFICATION_TYPES.join(", ")}` }
);

// ─── Get Notifications (Paginated) ────────────────────────────────────────────

export const getNotificationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce
      .number({ error: "Page must be a positive integer" })
      .int("Page must be an integer")
      .min(1, "Page must be at least 1")
      .default(1),
    limit: z.coerce
      .number({ error: "Limit must be a positive integer" })
      .int("Limit must be an integer")
      .min(1, "Limit must be at least 1")
      .max(100, "Limit cannot exceed 100")
      .default(20),
    isRead: z.preprocess((val) => {
      if (typeof val === "string") {
        if (val.toLowerCase() === "true") return true;
        if (val.toLowerCase() === "false") return false;
      }
      return val;
    }, z.boolean().optional()),
    type: notificationTypeEnum.optional(),
    projectId: z.string().uuid("Project ID must be a valid UUID").optional(),
  }),
});

// ─── Mark Notification As Read ────────────────────────────────────────────────

export const markNotificationReadSchema = z.object({
  params: z.object({
    notificationId: z.string().uuid("Notification ID must be a valid UUID"),
  }),
});

// ─── Mark All Notifications As Read ───────────────────────────────────────────

export const markAllReadSchema = z.object({
  body: z.object({
    projectId: z.string().uuid("Project ID must be a valid UUID").optional(),
  }).optional().default({}),
});

// ─── Delete Notification ──────────────────────────────────────────────────────

export const deleteNotificationSchema = z.object({
  params: z.object({
    notificationId: z.string().uuid("Notification ID must be a valid UUID"),
  }),
});

// ─── Clear All Notifications ──────────────────────────────────────────────────

export const clearAllNotificationsSchema = z.object({
  query: z.object({
    readOnly: z.preprocess((val) => {
      if (typeof val === "string") {
        if (val.toLowerCase() === "true") return true;
        if (val.toLowerCase() === "false") return false;
      }
      return val;
    }, z.boolean().optional().default(false)),
  }),
});

// ─── Test SendGrid Email Dispatch ─────────────────────────────────────────────

export const testEmailSchema = z.object({
  body: z.object({
    to: z.string().email("A valid recipient email address is required"),
    subject: z.string().min(1, "Subject is required").default("TeamFlow Test Notification"),
    message: z.string().min(1, "Message is required").default("This is a test notification email from TeamFlow."),
  }),
});
