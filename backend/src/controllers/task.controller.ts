import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { TaskService } from "../services/task.service";
import { Task, TaskStatus } from "../models/task.model";
import { uploadBufferToCloudinary } from "../utils/cloudinary";

/**
 * Helper function to extract any files attached via Multer from req.file / req.files
 * and upload them to Cloudinary, returning an array of secure URLs.
 */
const extractAndUploadFiles = async (req: Request, projectId: string): Promise<string[]> => {
    const rawFiles: Express.Multer.File[] = [];

    if (req.file) {
        rawFiles.push(req.file);
    }

    if (req.files) {
        if (Array.isArray(req.files)) {
            for (const f of req.files) {
                if (!rawFiles.includes(f)) rawFiles.push(f);
            }
        } else {
            const dict = req.files as { [fieldname: string]: Express.Multer.File[] };
            for (const field of Object.keys(dict)) {
                for (const f of dict[field]) {
                    if (!rawFiles.includes(f)) rawFiles.push(f);
                }
            }
        }
    }

    if (rawFiles.length === 0) return [];

    const uploadPromises = rawFiles.map(async (file) => {
        let resourceType: "image" | "raw" | "video" | "auto" = "auto";
        if (file.mimetype.startsWith("image/")) {
            resourceType = "image";
        } else if (file.mimetype.startsWith("video/")) {
            resourceType = "video";
        } else if (file.mimetype === "application/pdf") {
            resourceType = "raw";
        }

        const result = await uploadBufferToCloudinary(file.buffer, {
            folder: `teamflow/projects/${projectId}/tasks`,
            resourceType,
            originalFilename: file.originalname,
            tags: ["task-attachment", `project-${projectId}`],
        });

        return result.secureUrl || result.url;
    });

    return Promise.all(uploadPromises);
};

export class TaskController {
    /**
     * POST /projects/:projectId/tasks/upload
     *
     * Uploads one or multiple image screenshots, PDF documents, or demo videos to Cloudinary.
     * Returns the uploaded file(s) Cloudinary secure URL and metadata.
     */
    public static uploadAttachment = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId } = req.params as { projectId: string };

            // Collect all files from single 'file' or multiple 'files' fields
            const rawFiles: Express.Multer.File[] = [];

            if (req.file) {
                rawFiles.push(req.file);
            }

            if (req.files) {
                if (Array.isArray(req.files)) {
                    for (const f of req.files) {
                        if (!rawFiles.includes(f)) rawFiles.push(f);
                    }
                } else {
                    const dict = req.files as { [fieldname: string]: Express.Multer.File[] };
                    for (const field of Object.keys(dict)) {
                        for (const f of dict[field]) {
                            if (!rawFiles.includes(f)) rawFiles.push(f);
                        }
                    }
                }
            }

            if (rawFiles.length === 0) {
                throw new ApiError(
                    400,
                    "No file provided. Please provide one or more files under the multipart form-data field 'file' or 'files'."
                );
            }

            // Upload all files in parallel to Cloudinary
            const uploadPromises = rawFiles.map(async (file) => {
                let resourceType: "image" | "raw" | "video" | "auto" = "auto";
                if (file.mimetype.startsWith("image/")) {
                    resourceType = "image";
                } else if (file.mimetype.startsWith("video/")) {
                    resourceType = "video";
                } else if (file.mimetype === "application/pdf") {
                    resourceType = "raw";
                }

                return uploadBufferToCloudinary(file.buffer, {
                    folder: `teamflow/projects/${projectId}/tasks`,
                    resourceType,
                    originalFilename: file.originalname,
                    tags: ["task-attachment", `project-${projectId}`],
                });
            });

            const uploadResults = await Promise.all(uploadPromises);

            const responseData = uploadResults.length === 1
                ? {
                    ...uploadResults[0],
                    files: uploadResults,
                }
                : {
                    files: uploadResults,
                };

            res.status(200).json(
                new ApiResponse(
                    200,
                    responseData,
                    `${uploadResults.length} file(s) uploaded successfully to Cloudinary`
                )
            );
        }
    );

    /**
     * DELETE /projects/:projectId/tasks/attachments
     *
     * Deletes an attachment from Cloudinary by its publicId and optionally
     * removes its reference from a task's images/attachments list.
     */
    public static deleteAttachment = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId } = req.params as { projectId: string };
            const actorId = req.user?.uuid?.id;

            const { publicId, resourceType, taskId, fileUrl } = req.body as {
                publicId: string;
                resourceType?: "image" | "raw" | "video" | "auto";
                taskId?: string;
                fileUrl?: string;
            };

            const result = await TaskService.deleteAttachment(
                projectId,
                publicId,
                resourceType,
                taskId,
                fileUrl,
                actorId
            );

            res.status(200).json(
                new ApiResponse(
                    200,
                    result,
                    "Attachment deleted successfully from Cloudinary"
                )
            );
        }
    );

    /**
     * POST /projects/:projectId/tasks
     *
     * Creates a new task inside the specified project workspace.
     * Supports multipart/form-data (with direct file uploads) or JSON payloads.
     */
    public static createTask = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId } = req.params as { projectId: string };
            const actorId = req.user?.uuid?.id;

            if (!actorId) {
                throw new ApiError(401, "User session not found");
            }

            const { title, description, assigneeId, status, images, videoUrl } = req.body as {
                title: string;
                description?: string;
                assigneeId?: string;
                status?: TaskStatus;
                images?: string[];
                videoUrl?: string | null;
            };

            // Upload any files attached via Multer in this request
            const newlyUploadedUrls = await extractAndUploadFiles(req, projectId);
            const finalImages = [...(images || []), ...newlyUploadedUrls];

            const task = await TaskService.createTask(
                projectId,
                title,
                actorId,
                description,
                assigneeId,
                status,
                finalImages,
                videoUrl
            );

            res.status(201).json(
                new ApiResponse(201, task, "Task created successfully")
            );
        }
    );

    /**
     * GET /projects/:projectId/tasks
     *
     * Returns a paginated, filtered list of non-deleted tasks for the project.
     * Supports query params: page, limit, status (Kanban column filter).
     */
    public static getProjectTasks = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId } = req.params as { projectId: string };

            const { page, limit, status } = req.query as unknown as {
                page: number;
                limit: number;
                status?: TaskStatus;
            };

            const result = await TaskService.getProjectTasks(projectId, {
                page,
                limit,
                status,
            });

            res.status(200).json(
                new ApiResponse(200, result, "Project tasks retrieved successfully")
            );
        }
    );

    /**
     * PATCH /projects/:projectId/tasks/:taskId
     *
     * Updates any details of a task (title, description, assigneeId, status, images, videoUrl).
     * Supports direct multipart/form-data uploads via Multer.
     */
    public static updateTask = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId, taskId } = req.params as {
                projectId: string;
                taskId: string;
            };
            const actorId = req.user?.uuid?.id;

            if (!actorId) {
                throw new ApiError(401, "User session not found");
            }

            const updates = req.body as {
                title?: string;
                description?: string | null;
                assigneeId?: string | null;
                status?: TaskStatus;
                images?: string[];
                videoUrl?: string | null;
            };

            // Upload any files attached via Multer in this request
            const newlyUploadedUrls = await extractAndUploadFiles(req, projectId);
            let finalImages = updates.images;
            if (newlyUploadedUrls.length > 0) {
                if (finalImages !== undefined) {
                    finalImages = [...finalImages, ...newlyUploadedUrls];
                } else {
                    const existingTask = await Task.findOne({ taskId, projectId, isDeleted: false });
                    finalImages = [...(existingTask?.images || []), ...newlyUploadedUrls];
                }
            }

            const updatedTask = await TaskService.updateTask(
                taskId,
                projectId,
                {
                    ...updates,
                    ...(finalImages !== undefined ? { images: finalImages } : {}),
                },
                actorId
            );

            res.status(200).json(
                new ApiResponse(200, updatedTask, "Task updated successfully")
            );
        }
    );

    /**
     * DELETE /projects/:projectId/tasks/:taskId
     *
     * Performs a resilient soft-delete: sets isDeleted=true on the read model
     * and appends a TASK_DELETED event to the immutable event log.
     * The physical record is preserved for audit trail and event sourcing purposes.
     */
    public static softDeleteTask = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId, taskId } = req.params as {
                projectId: string;
                taskId: string;
            };
            const actorId = req.user?.uuid?.id;

            if (!actorId) {
                throw new ApiError(401, "User session not found");
            }

            await TaskService.softDeleteTask(taskId, projectId, actorId);

            res.status(200).json(
                new ApiResponse(200, null, "Task deleted successfully")
            );
        }
    );

    /**
     * DELETE /projects/:projectId/tasks/bulk
     *
     * Performs bulk soft-delete on multiple tasks inside the project workspace.
     */
    public static bulkDeleteTasks = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId } = req.params as { projectId: string };
            const actorId = req.user?.uuid?.id;

            if (!actorId) {
                throw new ApiError(401, "User session not found");
            }

            const { taskIds } = req.body as { taskIds: string[] };

            await TaskService.bulkDeleteTasks(taskIds, projectId, actorId);

            res.status(200).json(
                new ApiResponse(200, null, "Tasks deleted successfully")
            );
        }
    );

    /**
     * GET /projects/:projectId/tasks/:taskId/events
     *
     * Returns the full chronological event log for a single task —
     * every TASK_CREATED, STATUS_CHANGED, and TASK_DELETED event
     * enriched with the actor's profile data.
     */
    public static getTaskEvents = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId, taskId } = req.params as {
                projectId: string;
                taskId: string;
            };

            const events = await TaskService.getTaskEvents(taskId, projectId);

            res.status(200).json(
                new ApiResponse(200, events, "Task event history retrieved successfully")
            );
        }
    );

    /**
     * GET /projects/:projectId/tasks/events
     *
     * Returns all task events across every task in the project, sorted
     * chronologically — useful for a project-level activity/audit feed.
     */
    public static getProjectTaskEvents = asyncHandler(
        async (req: Request, res: Response): Promise<void> => {
            const { projectId } = req.params as { projectId: string };

            const events = await TaskService.getProjectTaskEvents(projectId);

            res.status(200).json(
                new ApiResponse(200, events, "Project task events retrieved successfully")
            );
        }
    );
}
