import { z } from "zod";
import { TASK_STATUSES } from "../models/task.model";

// ─── Reusable Status Enum ─────────────────────────────────────────────────────

const taskStatusEnum = z.enum(
    TASK_STATUSES as [string, ...string[]],
    { message: "Status must be one of: todo, inprogress, underreview, done" }
);

// ─── Create Task ──────────────────────────────────────────────────────────────

/**
 * Validates the request body when creating a new task.
 * If status is 'done', at least one screenshot/image is strictly required.
 */
export const createTaskSchema = z.object({
    body: z
        .object({
            title: z
                .string({ error: "Task title is required" })
                .trim()
                .min(1, "Task title cannot be empty")
                .max(200, "Task title cannot exceed 200 characters"),
            description: z
                .string()
                .trim()
                .max(2000, "Description cannot exceed 2000 characters")
                .optional(),
            assigneeId: z
                .string()
                .trim()
                .min(1, "Assignee ID cannot be empty")
                .optional(),
            status: taskStatusEnum.optional(),
            images: z
                .array(z.string().trim().min(1, "Image/document URL cannot be empty"))
                .optional()
                .default([]),
            videoUrl: z
                .string()
                .trim()
                .url("Video URL must be a valid URL")
                .optional()
                .nullable(),
        })
        .superRefine((data, ctx) => {
            if (data.status === "done" && (!data.images || data.images.length === 0)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "At least one screenshot/image proof is mandatory when creating a task directly in 'done' status.",
                    path: ["images"],
                });
            }
        }),
});

// ─── Update Task Status ───────────────────────────────────────────────────────

/**
 * Validates the request body when transitioning a task's status.
 * The status field is required and strictly enum-validated.
 */
export const updateTaskStatusSchema = z.object({
    body: z
        .object({
            status: taskStatusEnum,
            images: z
                .array(z.string().trim().min(1, "Image/document URL cannot be empty"))
                .optional(),
            videoUrl: z
                .string()
                .trim()
                .url("Video URL must be a valid URL")
                .optional()
                .nullable(),
        }),
});

// ─── Update Task (General) ───────────────────────────────────────────────────

/**
 * Validates the request body when updating any details of a task (title, description, assigneeId, status, images, videoUrl).
 */
export const updateTaskSchema = z.object({
    body: z
        .object({
            title: z
                .string()
                .trim()
                .min(1, "Task title cannot be empty")
                .max(200, "Task title cannot exceed 200 characters")
                .optional(),
            description: z
                .string()
                .trim()
                .max(2000, "Description cannot exceed 2000 characters")
                .optional()
                .nullable(),
            assigneeId: z
                .string()
                .trim()
                .optional()
                .nullable(),
            status: taskStatusEnum.optional(),
            images: z
                .array(z.string().trim().min(1, "Image/document URL cannot be empty"))
                .optional(),
            videoUrl: z
                .string()
                .trim()
                .url("Video URL must be a valid URL")
                .optional()
                .nullable(),
        }),
});

// ─── Get Project Tasks (Paginated) ────────────────────────────────────────────

/**
 * Validates and coerces query parameters for the paginated task listing endpoint.
 * Query params arrive as raw strings from Express — coerce.number() handles the conversion.
 */
export const getTasksQuerySchema = z.object({
    query: z.object({
        /** Current page number — minimum 1, defaults to 1 */
        page: z.coerce
            .number({ error: "Page must be a positive integer" })
            .int("Page must be an integer")
            .min(1, "Page must be at least 1")
            .default(1),
        /** Records per page — clamped between 1 and 100, defaults to 20 */
        limit: z.coerce
            .number({ error: "Limit must be a positive integer" })
            .int("Limit must be an integer")
            .min(1, "Limit must be at least 1")
            .max(100, "Limit cannot exceed 100")
            .default(20),
        /** Optional status filter — narrows results to a single Kanban column */
        status: taskStatusEnum.optional(),
    }),
});

// ─── Bulk Delete Tasks ────────────────────────────────────────────────────────

/**
 * Validates bulk deletion of tasks. Expects body.taskIds as array of UUID strings.
 */
export const bulkDeleteTasksSchema = z.object({
    body: z.object({
        taskIds: z
            .array(z.string().uuid("Task IDs must be valid UUIDs"))
            .min(1, "At least one task ID is required to delete"),
    }),
});

// ─── Delete Cloudinary File / Task Attachment ────────────────────────────────

/**
 * Validates deletion of an asset from Cloudinary and optionally removing it from a Task document.
 */
export const deleteAttachmentSchema = z.object({
    body: z.object({
        /** Cloudinary asset public ID to delete */
        publicId: z
            .string({ error: "Cloudinary publicId is required" })
            .trim()
            .min(1, "publicId cannot be empty"),
        /** Resource type: image, raw (for PDFs/documents), video, or auto */
        resourceType: z
            .enum(["image", "raw", "video", "auto"], {
                message: "resourceType must be one of: image, raw, video, auto",
            })
            .optional()
            .default("auto"),
        /** Optional task UUID to remove the file from the task's images/attachments list */
        taskId: z
            .string()
            .uuid("Task ID must be a valid UUID")
            .optional(),
        /** Optional specific file URL to detach from the task */
        fileUrl: z
            .string()
            .trim()
            .optional(),
    }),
});
