import { ITask, Task, TaskStatus } from "../models/task.model";
import { Project } from "../models/project.model";
import { TaskEvent } from "../models/taskEvent.model";
import { User } from "../models/user.model";
import { emitProjectEvent } from "../sockets/project.socket";
import { ApiError } from "../utils/ApiError";
import { deleteFromCloudinary } from "../utils/cloudinary";
import { NotificationService } from "./notification.service";
import { addAuditJob } from "../queues/audit.queue";
import { CacheUtil } from "../utils/cache";

// ─── Pagination Types ─────────────────────────────────────────────────────────

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedTasks {
    tasks: ITask[];
    pagination: PaginationMeta;
}

export interface GetTasksQuery {
    page: number;
    limit: number;
    status?: TaskStatus;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class TaskService {
    /**
     * Helper to enrich tasks with their assignee's profile details.
     */
    public static async enrichTasks(tasks: any[]): Promise<any[]> {
        if (tasks.length === 0) return [];

        const assigneeIds = new Set<string>();
        for (const t of tasks) {
            if (t.assigneeId) assigneeIds.add(t.assigneeId);
        }

        const users = await User.find({ "uuid.id": { $in: Array.from(assigneeIds) } }).lean();
        const userMap = new Map<string, any>();
        for (const u of users) {
            userMap.set(u.uuid.id, u);
        }

        return tasks.map((t) => {
            const tObj = typeof t.toObject === "function" ? t.toObject() : t;
            const assigneeUser = tObj.assigneeId ? userMap.get(tObj.assigneeId) : null;
            return {
                ...tObj,
                assignee: assigneeUser
                    ? {
                        name: assigneeUser.name,
                        username: assigneeUser.username,
                        email: assigneeUser.email,
                    }
                    : null,
            };
        });
    }

    /**
     * Creates a new task inside the given project workspace.
     */
    public static async createTask(
        projectId: string,
        title: string,
        actorId: string,
        description?: string,
        assigneeId?: string,
        status: TaskStatus = "todo",
        images: string[] = [],
        videoUrl?: string | null,
        context?: { ip?: string; userAgent?: string; correlationId?: string }
    ): Promise<ITask> {
        // Pre-flight: verify project exists and is not archived
        const project = await Project.findOne({ projectId, isDeleted: { $ne: true } });
        if (!project) {
            throw new ApiError(404, "Project workspace not found or has been deleted");
        }
        if (project.isArchived) {
            throw new ApiError(400, "Cannot create tasks in an archived project workspace");
        }

        // Validate assignee is a workspace member
        if (assigneeId) {
            const isMember = project.owner === assigneeId || project.members.some((m) => m.userId === assigneeId);
            if (!isMember) {
                throw new ApiError(400, "Assigned user is not a member of this project workspace");
            }
        }

        // Enforce mandatory screenshot/image proof for 'done' status
        if (status === "done" && (!images || images.length === 0)) {
            throw new ApiError(
                400,
                "Validation Error: At least one screenshot/image proof is mandatory when creating a task directly in 'done' status. Please attach completed work screenshots."
            );
        }

        // 1. Insert the task read model
        const task = new Task({
            projectId,
            title,
            description,
            assigneeId,
            status,
            images: images || [],
            videoUrl: videoUrl || null,
        });
        const savedTask = await task.save();

        // 2. Invalidate project tasks cache
        await CacheUtil.invalidateTaskCache(projectId);

        // 3. Append immutable creation event
        try {
            await TaskEvent.create({
                taskId: savedTask.taskId,
                projectId,
                userId: actorId,
                eventType: "TASK_CREATED",
                payload: {
                    title: savedTask.title,
                    description: savedTask.description ?? null,
                    assigneeId: savedTask.assigneeId ?? null,
                    status: savedTask.status,
                    images: savedTask.images ?? [],
                    videoUrl: savedTask.videoUrl ?? null,
                    projectId,
                },
            });
        } catch (eventErr) {
            await Task.deleteOne({ taskId: savedTask.taskId }).catch(() => { });
            throw new ApiError(500, "Failed to record task creation event. Task rolled back.");
        }

        // 4. Asynchronously enqueue immutable audit log
        const actorUser = await User.findOne({ "uuid.id": actorId });
        await addAuditJob({
            action: "TASK_CREATED",
            actor: {
                userId: actorId,
                email: actorUser?.email || "unknown@teamflow.app",
                role: "TeamMember",
            },
            resource: {
                type: "TASK",
                id: savedTask.taskId,
                name: savedTask.title,
            },
            context: {
                ip: context?.ip,
                userAgent: context?.userAgent,
                correlationId: context?.correlationId,
            },
            diff: {
                after: {
                    title: savedTask.title,
                    status: savedTask.status,
                    assigneeId: savedTask.assigneeId,
                    projectId,
                },
            },
            metadata: {
                projectId,
                taskId: savedTask.taskId,
            },
        });

        const enriched = await TaskService.enrichTasks([savedTask]);
        const enrichedTask = enriched[0];

        // 5. Real-time broadcast to all project room members
        emitProjectEvent(projectId, "task:created", enrichedTask);

        // 6. Dispatch in-app notifications and SendGrid emails via BullMQ
        NotificationService.notifyTaskCreated(
            projectId,
            project.name,
            savedTask.taskId,
            savedTask.title,
            actorId,
            savedTask.assigneeId,
            savedTask.status,
            savedTask.images?.length || 0,
            Boolean(savedTask.videoUrl)
        ).catch(() => {});

        return enrichedTask;
    }

    /**
     * Retrieves all non-deleted tasks for a project with cache-aside support and pagination.
     */
    public static async getProjectTasks(
        projectId: string,
        query: GetTasksQuery
    ): Promise<PaginatedTasks> {
        const { page, limit, status } = query;
        const skip = (page - 1) * limit;

        const cacheKey = `cache:project:${projectId}:tasks:${page}:${limit}:${status || "all"}`;
        const cachedData = await CacheUtil.get<PaginatedTasks>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const filter: Record<string, any> = { projectId, isDeleted: false };
        if (status) {
            filter.status = status;
        }

        const [total, tasks] = await Promise.all([
            Task.countDocuments(filter),
            Task.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const enrichedTasks = await TaskService.enrichTasks(tasks);

        const result: PaginatedTasks = {
            tasks: enrichedTasks as unknown as ITask[],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };

        // Cache for 60 seconds
        await CacheUtil.set(cacheKey, result, 60);

        return result;
    }

    /**
     * Updates details of a task (title, description, assigneeId, status, images, videoUrl).
     */
    public static async updateTask(
        taskId: string,
        projectId: string,
        updates: {
            title?: string;
            description?: string | null;
            assigneeId?: string | null;
            status?: TaskStatus;
            images?: string[];
            videoUrl?: string | null;
        },
        actorId: string,
        context?: { ip?: string; userAgent?: string; correlationId?: string }
    ): Promise<ITask> {
        const project = await Project.findOne({ projectId, isDeleted: { $ne: true } });
        if (!project) {
            throw new ApiError(404, "Project workspace not found or has been deleted");
        }
        if (project.isArchived) {
            throw new ApiError(400, "Cannot modify tasks in an archived project workspace");
        }

        if (updates.assigneeId) {
            const isMember = project.owner === updates.assigneeId || project.members.some((m) => m.userId === updates.assigneeId);
            if (!isMember) {
                throw new ApiError(400, "Assigned user is not a member of this project workspace");
            }
        }

        const existingTask = await Task.findOne({ taskId, projectId, isDeleted: false });
        if (!existingTask) {
            throw new ApiError(404, "Task not found or has been deleted");
        }

        const targetStatus = updates.status !== undefined ? updates.status : existingTask.status;
        const targetImages = updates.images !== undefined ? updates.images : (existingTask.images || []);

        if (targetStatus === "done" && (!targetImages || targetImages.length === 0)) {
            throw new ApiError(
                400,
                "Validation Error: At least one screenshot/image proof is mandatory when transitioning task to 'done' status. Please attach completed work screenshots."
            );
        }

        const eventsToCreate: any[] = [];
        const fieldsToUpdate: Record<string, any> = {};
        const beforeDiff: Record<string, any> = {};
        const afterDiff: Record<string, any> = {};

        if (updates.title !== undefined && updates.title !== existingTask.title) {
            fieldsToUpdate.title = updates.title;
            beforeDiff.title = existingTask.title;
            afterDiff.title = updates.title;
            eventsToCreate.push({
                taskId,
                projectId,
                userId: actorId,
                eventType: "TASK_UPDATED",
                payload: { field: "title", previousValue: existingTask.title, newValue: updates.title, title: existingTask.title },
            });
        }

        const previousDesc = existingTask.description || null;
        const newDesc = updates.description === undefined ? undefined : (updates.description || null);
        if (newDesc !== undefined && newDesc !== previousDesc) {
            fieldsToUpdate.description = newDesc;
            beforeDiff.description = previousDesc;
            afterDiff.description = newDesc;
            eventsToCreate.push({
                taskId,
                projectId,
                userId: actorId,
                eventType: "TASK_UPDATED",
                payload: { field: "description", previousValue: previousDesc, newValue: newDesc, title: existingTask.title },
            });
        }

        const previousAssignee = existingTask.assigneeId || null;
        const newAssignee = updates.assigneeId === undefined ? undefined : (updates.assigneeId || null);
        if (newAssignee !== undefined && newAssignee !== previousAssignee) {
            fieldsToUpdate.assigneeId = newAssignee;
            beforeDiff.assigneeId = previousAssignee;
            afterDiff.assigneeId = newAssignee;
            eventsToCreate.push({
                taskId,
                projectId,
                userId: actorId,
                eventType: "ASSIGNEE_CHANGED",
                payload: { previousAssigneeId: previousAssignee, newAssigneeId: newAssignee, title: existingTask.title },
            });
        }

        if (updates.status !== undefined && updates.status !== existingTask.status) {
            fieldsToUpdate.status = updates.status;
            beforeDiff.status = existingTask.status;
            afterDiff.status = updates.status;
            eventsToCreate.push({
                taskId,
                projectId,
                userId: actorId,
                eventType: "STATUS_CHANGED",
                payload: {
                    previousStatus: existingTask.status,
                    newStatus: updates.status,
                    title: existingTask.title,
                    images: targetImages,
                    videoUrl: updates.videoUrl !== undefined ? updates.videoUrl : existingTask.videoUrl,
                },
            });
        }

        if (updates.images !== undefined) {
            fieldsToUpdate.images = updates.images;
            eventsToCreate.push({
                taskId,
                projectId,
                userId: actorId,
                eventType: "TASK_UPDATED",
                payload: {
                    field: "images",
                    previousValue: existingTask.images || [],
                    newValue: updates.images,
                    title: existingTask.title,
                },
            });
        }

        const previousVideo = existingTask.videoUrl || null;
        const newVideo = updates.videoUrl === undefined ? undefined : (updates.videoUrl || null);
        if (newVideo !== undefined && newVideo !== previousVideo) {
            fieldsToUpdate.videoUrl = newVideo;
            eventsToCreate.push({
                taskId,
                projectId,
                userId: actorId,
                eventType: "TASK_UPDATED",
                payload: {
                    field: "videoUrl",
                    previousValue: previousVideo,
                    newValue: newVideo,
                    title: existingTask.title,
                },
            });
        }

        if (Object.keys(fieldsToUpdate).length === 0) {
            const enriched = await TaskService.enrichTasks([existingTask]);
            return enriched[0];
        }

        const createdEvents = await TaskEvent.insertMany(eventsToCreate);

        let updatedTask: ITask | null;
        try {
            updatedTask = await Task.findOneAndUpdate(
                { taskId, projectId, isDeleted: false },
                { $set: fieldsToUpdate },
                { new: true }
            );

            if (!updatedTask) {
                throw new Error("Task document disappeared during update");
            }
        } catch (updateErr) {
            const eventIds = createdEvents.map((e) => e._id);
            await TaskEvent.deleteMany({ _id: { $in: eventIds } }).catch(() => { });
            throw new ApiError(500, "Failed to update task. Events rolled back.");
        }

        // Invalidate cached tasks
        await CacheUtil.invalidateTaskCache(projectId);

        // Asynchronously enqueue audit log
        const actorUser = await User.findOne({ "uuid.id": actorId });
        await addAuditJob({
            action: fieldsToUpdate.status ? "TASK_STATUS_UPDATED" : "TASK_UPDATED",
            actor: {
                userId: actorId,
                email: actorUser?.email || "unknown@teamflow.app",
                role: "TeamMember",
            },
            resource: {
                type: "TASK",
                id: taskId,
                name: updatedTask.title,
            },
            context: {
                ip: context?.ip,
                userAgent: context?.userAgent,
                correlationId: context?.correlationId,
            },
            diff: {
                before: beforeDiff,
                after: afterDiff,
            },
            metadata: {
                projectId,
                taskId,
                modifiedFields: Object.keys(fieldsToUpdate),
            },
        });

        const enriched = await TaskService.enrichTasks([updatedTask]);
        const enrichedTask = enriched[0];

        // Real-time broadcast
        if (fieldsToUpdate.status) {
            emitProjectEvent(projectId, "task:status_changed", {
                taskId,
                projectId,
                previousStatus: existingTask.status,
                newStatus: fieldsToUpdate.status,
                updatedAt: enrichedTask.updatedAt,
                actorId,
            });
        }

        emitProjectEvent(projectId, "task:updated", enrichedTask);

        // Dispatch in-app notifications and SendGrid emails via BullMQ
        NotificationService.notifyTaskUpdated({
            projectId,
            projectName: project.name,
            taskId,
            taskTitle: enrichedTask.title,
            actorId,
            updates: {
                status: fieldsToUpdate.status,
                previousStatus: existingTask.status,
                assigneeId: fieldsToUpdate.assigneeId,
                previousAssigneeId: existingTask.assigneeId,
                images: fieldsToUpdate.images,
                previousImages: existingTask.images,
                videoUrl: fieldsToUpdate.videoUrl,
                previousVideoUrl: existingTask.videoUrl,
                title: fieldsToUpdate.title,
                description: fieldsToUpdate.description,
            },
        }).catch(() => {});

        return enrichedTask;
    }

    /**
     * Soft-deletes a task by flipping isDeleted to true.
     */
    public static async softDeleteTask(
        taskId: string,
        projectId: string,
        actorId: string,
        context?: { ip?: string; userAgent?: string; correlationId?: string }
    ): Promise<{ success: boolean }> {
        const project = await Project.findOne({ projectId, isDeleted: { $ne: true } });
        if (!project) {
            throw new ApiError(404, "Project workspace not found or has been deleted");
        }
        if (project.isArchived) {
            throw new ApiError(400, "Cannot delete tasks in an archived project workspace");
        }

        const existingTask = await Task.findOne({ taskId, projectId, isDeleted: false });
        if (!existingTask) {
            throw new ApiError(404, "Task not found or has already been deleted");
        }

        // 1. Flip isDeleted on read model
        await Task.updateOne({ taskId, projectId }, { $set: { isDeleted: true } });

        // 2. Invalidate cache
        await CacheUtil.invalidateTaskCache(projectId);

        // 3. Write event
        try {
            await TaskEvent.create({
                taskId,
                projectId,
                userId: actorId,
                eventType: "TASK_DELETED",
                payload: {
                    taskId,
                    title: existingTask.title,
                },
            });
        } catch (eventErr) {
            await Task.updateOne({ taskId, projectId }, { $set: { isDeleted: false } }).catch(() => { });
            throw new ApiError(500, "Failed to record deletion event. Task restore attempted.");
        }

        // 4. Asynchronously enqueue audit log
        const actorUser = await User.findOne({ "uuid.id": actorId });
        await addAuditJob({
            action: "TASK_DELETED",
            actor: {
                userId: actorId,
                email: actorUser?.email || "unknown@teamflow.app",
                role: "TeamMember",
            },
            resource: {
                type: "TASK",
                id: taskId,
                name: existingTask.title,
            },
            context: {
                ip: context?.ip,
                userAgent: context?.userAgent,
                correlationId: context?.correlationId,
            },
            diff: {
                before: { isDeleted: false },
                after: { isDeleted: true },
            },
            metadata: {
                projectId,
                taskId,
            },
        });

        // 5. Real-time broadcast
        emitProjectEvent(projectId, "task:deleted", {
            taskId,
            projectId,
            actorId,
        });

        // 6. Dispatch in-app notifications and SendGrid emails
        NotificationService.notifyTaskDeleted(
            projectId,
            project.name,
            taskId,
            existingTask.title,
            actorId,
            existingTask.assigneeId
        ).catch(() => {});

        return { success: true };
    }

    /**
     * Bulk soft-deletes a list of tasks inside a project.
     */
    public static async bulkDeleteTasks(
        taskIds: string[],
        projectId: string,
        actorId: string,
        context?: { ip?: string; userAgent?: string; correlationId?: string }
    ): Promise<{ success: boolean }> {
        if (taskIds.length === 0) {
            return { success: true };
        }

        const project = await Project.findOne({ projectId, isDeleted: { $ne: true } });
        if (!project) {
            throw new ApiError(404, "Project workspace not found or has been deleted");
        }
        if (project.isArchived) {
            throw new ApiError(400, "Cannot delete tasks in an archived project workspace");
        }

        const tasks = await Task.find({
            taskId: { $in: taskIds },
            projectId,
            isDeleted: false,
        });

        if (tasks.length === 0) {
            throw new ApiError(404, "No active tasks found matching the provided IDs");
        }

        const foundTaskIds = tasks.map((t) => t.taskId);

        // 1. Flip isDeleted on read models
        await Task.updateMany(
            { taskId: { $in: foundTaskIds }, projectId },
            { $set: { isDeleted: true } }
        );

        // 2. Invalidate cache
        await CacheUtil.invalidateTaskCache(projectId);

        // 3. Write events
        const eventsToCreate = tasks.map((t) => ({
            taskId: t.taskId,
            projectId,
            userId: actorId,
            eventType: "TASK_DELETED",
            payload: {
                taskId: t.taskId,
                title: t.title,
            },
        }));

        try {
            await TaskEvent.insertMany(eventsToCreate);
        } catch (eventErr) {
            await Task.updateMany(
                { taskId: { $in: foundTaskIds }, projectId },
                { $set: { isDeleted: false } }
            ).catch(() => { });
            throw new ApiError(500, "Failed to record bulk deletion events. Tasks restore attempted.");
        }

        // 4. Asynchronously enqueue audit log
        const actorUser = await User.findOne({ "uuid.id": actorId });
        await addAuditJob({
            action: "TASK_BULK_DELETED",
            actor: {
                userId: actorId,
                email: actorUser?.email || "unknown@teamflow.app",
                role: "TeamMember",
            },
            resource: {
                type: "PROJECT",
                id: projectId,
                name: project.name,
            },
            context: {
                ip: context?.ip,
                userAgent: context?.userAgent,
                correlationId: context?.correlationId,
            },
            metadata: {
                projectId,
                deletedTaskIds: foundTaskIds,
                count: foundTaskIds.length,
            },
        });

        // 5. Real-time broadcast
        emitProjectEvent(projectId, "task:bulk_deleted", {
            taskIds: foundTaskIds,
            projectId,
            actorId,
        });

        // 6. Dispatch in-app notifications and SendGrid emails
        for (const t of tasks) {
            NotificationService.notifyTaskDeleted(
                projectId,
                project.name,
                t.taskId,
                t.title,
                actorId,
                t.assigneeId
            ).catch(() => {});
        }

        return { success: true };
    }

    /**
     * Retrieves the full chronological event history for a single task.
     */
    public static async getTaskEvents(
        taskId: string,
        projectId: string
    ): Promise<any[]> {
        const task = await Task.findOne({ taskId, projectId });
        if (!task) {
            throw new ApiError(404, "Task not found in this project");
        }

        const events = await TaskEvent.find({ taskId })
            .sort({ timestamp: 1 })
            .lean();

        const actorIds = [...new Set(events.map((e) => e.userId))];
        const users = await User.find({ "uuid.id": { $in: actorIds } }).lean();
        const userMap = new Map<string, { name: string; username: string; email: string }>();
        for (const u of users) {
            userMap.set(u.uuid.id, { name: u.name, username: u.username, email: u.email });
        }

        return events.map((e) => ({
            ...e,
            actor: userMap.get(e.userId) ?? {
                name: "Unknown User",
                username: "unknown",
                email: "",
            },
        }));
    }

    /**
     * Retrieves all task events scoped to an entire project.
     */
    public static async getProjectTaskEvents(projectId: string): Promise<any[]> {
        const events = await TaskEvent.find({ projectId })
            .sort({ timestamp: 1 })
            .lean();

        const actorIds = [...new Set(events.map((e) => e.userId))];
        const users = await User.find({ "uuid.id": { $in: actorIds } }).lean();
        const userMap = new Map<string, { name: string; username: string; email: string }>();
        for (const u of users) {
            userMap.set(u.uuid.id, { name: u.name, username: u.username, email: u.email });
        }

        return events.map((e) => ({
            ...e,
            actor: userMap.get(e.userId) ?? {
                name: "Unknown User",
                username: "unknown",
                email: "",
            },
        }));
    }

    /**
     * Deletes a file asset from Cloudinary and removes its reference from task.
     */
    public static async deleteAttachment(
        projectId: string,
        publicId: string,
        resourceType: "image" | "raw" | "video" | "auto" = "auto",
        taskId?: string,
        fileUrl?: string,
        actorId?: string,
        context?: { ip?: string; userAgent?: string; correlationId?: string }
    ): Promise<{
        publicId: string;
        result: string;
        taskId?: string;
        task?: ITask | null;
    }> {
        const project = await Project.findOne({ projectId, isDeleted: { $ne: true } });
        if (!project) {
            throw new ApiError(404, "Project workspace not found or has been deleted");
        }
        if (project.isArchived) {
            throw new ApiError(400, "Cannot delete attachments in an archived project workspace");
        }

        const cloudResult = await deleteFromCloudinary(publicId, { resourceType });
        let updatedTask: ITask | null = null;

        if (taskId) {
            const existingTask = await Task.findOne({ taskId, projectId, isDeleted: false });
            if (existingTask) {
                const previousImages = existingTask.images || [];
                const newImages = previousImages.filter((imgUrl) => {
                    if (fileUrl && imgUrl === fileUrl) return false;
                    if (publicId && imgUrl.includes(publicId)) return false;
                    return true;
                });

                let newVideoUrl = existingTask.videoUrl;
                if (fileUrl && existingTask.videoUrl === fileUrl) {
                    newVideoUrl = null;
                } else if (publicId && existingTask.videoUrl && existingTask.videoUrl.includes(publicId)) {
                    newVideoUrl = null;
                }

                const hasImageChanges = newImages.length !== previousImages.length;
                const hasVideoChanges = newVideoUrl !== existingTask.videoUrl;

                if (hasImageChanges || hasVideoChanges) {
                    const fieldsToUpdate: Record<string, any> = {};
                    if (hasImageChanges) fieldsToUpdate.images = newImages;
                    if (hasVideoChanges) fieldsToUpdate.videoUrl = newVideoUrl;

                    const savedTask = await Task.findOneAndUpdate(
                        { taskId, projectId, isDeleted: false },
                        { $set: fieldsToUpdate },
                        { new: true }
                    );

                    await CacheUtil.invalidateTaskCache(projectId);

                    if (savedTask) {
                        if (actorId) {
                            await TaskEvent.create({
                                taskId,
                                projectId,
                                userId: actorId,
                                eventType: "TASK_UPDATED",
                                payload: {
                                    field: "attachments",
                                    deletedPublicId: publicId,
                                    deletedFileUrl: fileUrl,
                                    remainingImages: newImages,
                                    title: existingTask.title,
                                },
                            }).catch(() => {});

                            const actorUser = await User.findOne({ "uuid.id": actorId });
                            await addAuditJob({
                                action: "TASK_ATTACHMENT_DELETED",
                                actor: {
                                    userId: actorId,
                                    email: actorUser?.email || "unknown@teamflow.app",
                                    role: "TeamMember",
                                },
                                resource: {
                                    type: "TASK",
                                    id: taskId,
                                    name: existingTask.title,
                                },
                                context: {
                                    ip: context?.ip,
                                    userAgent: context?.userAgent,
                                    correlationId: context?.correlationId,
                                },
                                metadata: {
                                    projectId,
                                    taskId,
                                    publicId,
                                    fileUrl,
                                },
                            });
                        }

                        const enriched = await TaskService.enrichTasks([savedTask]);
                        updatedTask = enriched[0];

                        emitProjectEvent(projectId, "task:updated", updatedTask);
                    }
                } else {
                    const enriched = await TaskService.enrichTasks([existingTask]);
                    updatedTask = enriched[0];
                }
            }
        }

        return {
            publicId: cloudResult.publicId,
            result: cloudResult.result,
            taskId,
            task: updatedTask,
        };
    }
}
