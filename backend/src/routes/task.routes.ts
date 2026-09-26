import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { idempotencyMiddleware } from "../middleware/idempotency.middleware";
import { uploadTaskAttachments } from "../middleware/upload.middleware";
import { TaskController } from "../controllers/task.controller";
import {
    createTaskSchema,
    updateTaskSchema,
    getTasksQuerySchema,
    bulkDeleteTasksSchema,
    deleteAttachmentSchema,
} from "../validations/task.validation";

/**
 * Task subrouter — mounted under /projects/:projectId/tasks in project.routes.ts.
 *
 * All routes in this router inherit the `protect` auth guard (applied at the
 * root /api/v1 level) and the `checkMembership` middleware (applied at the
 * /:projectId prefix in project.routes.ts), so no extra auth checks are needed here.
 *
 * Per spec: all verified project members can perform full CRUD on tasks.
 * ProjectManager-only restriction is not applied at the task level.
 *
 * ⚠️  Route ordering is intentional:
 *   - Static segments (/events, /upload, /attachments) must be declared BEFORE param segments (/:taskId)
 *     to prevent Express from matching literal strings as a taskId.
 */
const router = Router({ mergeParams: true });

// ─── POST /projects/:projectId/tasks/upload ──────────────────────────────────
// Upload screenshot proofs, PDFs, or demo videos (single or multiple) to Cloudinary
router.post(
    "/upload",
    uploadTaskAttachments,
    TaskController.uploadAttachment
);

// ─── DELETE /projects/:projectId/tasks/attachments ───────────────────────────
// Delete attachment file from Cloudinary and optionally detach from Task document
router.delete(
    "/attachments",
    validate(deleteAttachmentSchema),
    TaskController.deleteAttachment
);

// ─── GET /projects/:projectId/tasks ──────────────────────────────────────────
// Paginated task listing with optional status filter
router.get(
    "/",
    validate(getTasksQuerySchema),
    TaskController.getProjectTasks
);

// ─── GET /projects/:projectId/tasks/events ───────────────────────────────────
// All task events across the entire project — project-level activity feed
// ⚠️  Must be above /:taskId to avoid "events" being matched as a taskId
router.get("/events", TaskController.getProjectTaskEvents);

// ─── POST /projects/:projectId/tasks ─────────────────────────────────────────
// Create a new task inside this project workspace (supports JSON or multipart/form-data with direct file attachments)
router.post(
    "/",
    uploadTaskAttachments,
    idempotencyMiddleware,
    validate(createTaskSchema),
    TaskController.createTask
);

// ─── GET /projects/:projectId/tasks/:taskId/events ───────────────────────────
// Chronological event history for a single task (audit trail)
router.get("/:taskId/events", TaskController.getTaskEvents);

// ─── PATCH /projects/:projectId/tasks/:taskId ────────────────────────────────
// General task updates — title, description, assignee, status (supports direct file attachments via multipart/form-data)
router.patch(
    "/:taskId",
    uploadTaskAttachments,
    idempotencyMiddleware,
    validate(updateTaskSchema),
    TaskController.updateTask
);

// ─── DELETE /projects/:projectId/tasks/bulk ─────────────────────────────────
// Bulk soft delete — sets isDeleted=true for multiple tasks
router.delete(
    "/bulk",
    idempotencyMiddleware,
    validate(bulkDeleteTasksSchema),
    TaskController.bulkDeleteTasks
);

// ─── DELETE /projects/:projectId/tasks/:taskId ───────────────────────────────
// Soft delete — sets isDeleted=true and appends TASK_DELETED event log
router.delete(
    "/:taskId",
    idempotencyMiddleware,
    TaskController.softDeleteTask
);

export default router;
