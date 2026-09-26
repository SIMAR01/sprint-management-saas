import { v4 as uuidv4 } from "uuid";
import { Schema, model, Document } from "mongoose";

export type NotificationType =
  | "PROJECT_CREATED"
  | "PROJECT_ARCHIVED"
  | "PROJECT_DELETED"
  | "MEMBER_INVITED"
  | "MEMBER_REMOVED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_ASSIGNED"
  | "TASK_DELETED"
  | "TASK_BULK_DELETED"
  | "TASK_ATTACHMENT_ADDED"
  | "TASK_ATTACHMENT_DELETED";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "PROJECT_CREATED",
  "PROJECT_ARCHIVED",
  "PROJECT_DELETED",
  "MEMBER_INVITED",
  "MEMBER_REMOVED",
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_STATUS_CHANGED",
  "TASK_ASSIGNED",
  "TASK_DELETED",
  "TASK_BULK_DELETED",
  "TASK_ATTACHMENT_ADDED",
  "TASK_ATTACHMENT_DELETED",
];

export interface INotification extends Document {
  /** Unique notification UUID identifier */
  notificationId: string;
  /** References recipient User.uuid.id */
  userId: string;
  /** References associated Project.projectId (if any) */
  projectId?: string | null;
  /** References associated Task.taskId (if any) */
  taskId?: string | null;
  /** Short notification headline/subject */
  title: string;
  /** Detailed human-readable notification message */
  message: string;
  /** Categorized event classification */
  type: NotificationType;
  /** Arbitrary metadata (actor, project name, task title, diffs, etc.) */
  data: Record<string, any>;
  /** Seen / Read status flag */
  isRead: boolean;
  /** Timestamp when notification was marked as read */
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
    },
    userId: {
      type: String,
      required: [true, "Recipient user ID is required"],
      index: true,
    },
    projectId: {
      type: String,
      default: null,
    },
    taskId: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

/**
 * Compound index for high-speed inbox queries:
 * Filtering by user and read state sorted chronologically.
 */
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ projectId: 1, createdAt: -1 });
notificationSchema.index({ taskId: 1, createdAt: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
