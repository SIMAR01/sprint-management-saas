import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { axiosClient } from "../../../api/axiosClient";
import {
  Task,
  PaginatedTasksResponse,
  SingleTaskResponse,
  CreateTaskPayload,
  UpdateTaskPayload,
  FileUploadResponse,
  DeleteAttachmentPayload,
} from "../types/task.types";

const generateIdempotencyKey = (prefix: string) => `${prefix}-${uuidv4()}`;

// ─── QUERIES ─────────────────────────────────────────────────────────────────

/**
 * Fetches all tasks for a given project.
 * Uses a high limit for the Kanban board view.
 */
export const useProjectTasksQuery = (projectId: string) => {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async (): Promise<Task[]> => {
      const response = await axiosClient.get<PaginatedTasksResponse>(
        `/projects/${projectId}/tasks?limit=100`
      );
      return response.data.data.tasks;
    },
    enabled: !!projectId,
  });
};

/**
 * Hook to retrieve the chronological activity timeline for a single task.
 */
export const useTaskEventsQuery = (projectId: string, taskId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["task-events", projectId, taskId],
    queryFn: async () => {
      const response = await axiosClient.get<{ data: any[] }>(
        `/projects/${projectId}/tasks/${taskId}/events`
      );
      return response.data.data;
    },
    enabled: !!projectId && !!taskId && enabled,
  });
};

// ─── FILE UPLOAD & ATTACHMENT MUTATIONS ──────────────────────────────────────

/**
 * Mutation to upload single or multiple files (images, PDFs, demo videos) directly
 * to Cloudinary via POST /projects/:projectId/tasks/upload.
 */
export const useUploadTaskAttachmentsMutation = (projectId: string) => {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      if (files.length === 1) {
        formData.append("file", files[0]);
      } else {
        files.forEach((file) => {
          formData.append("files", file);
        });
      }

      const response = await axiosClient.post<FileUploadResponse>(
        `/projects/${projectId}/tasks/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data.data;
    },
  });
};

/**
 * Mutation to delete an attachment file from Cloudinary and optionally detach from Task.
 */
export const useDeleteTaskAttachmentMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DeleteAttachmentPayload) => {
      const response = await axiosClient.delete<{
        statusCode: number;
        data: any;
        message: string;
      }>(`/projects/${projectId}/tasks/attachments`, {
        data: payload,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.taskId) {
        queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
        queryClient.invalidateQueries({ queryKey: ["task-events", projectId, variables.taskId] });
      }
    },
  });
};

// ─── TASK MUTATIONS ─────────────────────────────────────────────────────────

/**
 * Creates a new task with optimistic caching, attachment URLs, and video URL.
 */
export const useCreateTaskMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      const response = await axiosClient.post<SingleTaskResponse>(
        `/projects/${projectId}/tasks`,
        payload,
        {
          headers: {
            "X-Idempotency-Key": generateIdempotencyKey("task-create"),
          },
        }
      );
      return response.data.data;
    },
    onMutate: async (newTaskParams) => {
      await queryClient.cancelQueries({ queryKey: ["project-tasks", projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(["project-tasks", projectId]);

      const optimisticTask: Task = {
        taskId: `temp-${uuidv4()}`,
        projectId,
        title: newTaskParams.title,
        description: newTaskParams.description,
        assigneeId: newTaskParams.assigneeId,
        status: newTaskParams.status || "todo",
        images: newTaskParams.images || [],
        videoUrl: newTaskParams.videoUrl || null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Task[]>(["project-tasks", projectId], (old) => {
        if (!old) return [optimisticTask];
        return [optimisticTask, ...old]; // Prepend for visibility
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["project-tasks", projectId], context.previousTasks);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
};

/**
 * Updates a task (title, description, assignee, status, images, videoUrl) with optimistic caching.
 */
export const useUpdateTaskMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: UpdateTaskPayload }) => {
      const response = await axiosClient.patch<SingleTaskResponse>(
        `/projects/${projectId}/tasks/${taskId}`,
        updates,
        {
          headers: {
            "X-Idempotency-Key": generateIdempotencyKey("task-update"),
          },
        }
      );
      return response.data.data;
    },
    onMutate: async ({ taskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["project-tasks", projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(["project-tasks", projectId]);

      queryClient.setQueryData<Task[]>(["project-tasks", projectId], (old) => {
        if (!old) return [];
        return old.map((t) =>
          t.taskId === taskId ? ({ ...t, ...updates, updatedAt: new Date().toISOString() } as any) : t
        );
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["project-tasks", projectId], context.previousTasks);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-events", projectId, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-events", projectId, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
};

/**
 * Soft deletes a task with optimistic caching.
 */
export const useDeleteTaskMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      await axiosClient.delete(`/projects/${projectId}/tasks/${taskId}`, {
        headers: {
          "X-Idempotency-Key": generateIdempotencyKey("task-delete"),
        },
      });
      return taskId;
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["project-tasks", projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(["project-tasks", projectId]);

      queryClient.setQueryData<Task[]>(["project-tasks", projectId], (old) => {
        if (!old) return [];
        return old.filter((t) => t.taskId !== taskId);
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["project-tasks", projectId], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
};

/**
 * Soft deletes multiple tasks with optimistic caching.
 */
export const useBulkDeleteTasksMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      await axiosClient.delete(`/projects/${projectId}/tasks/bulk`, {
        data: { taskIds },
        headers: {
          "X-Idempotency-Key": generateIdempotencyKey("task-bulk-delete"),
        },
      });
      return taskIds;
    },
    onMutate: async (taskIds) => {
      await queryClient.cancelQueries({ queryKey: ["project-tasks", projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(["project-tasks", projectId]);

      queryClient.setQueryData<Task[]>(["project-tasks", projectId], (old) => {
        if (!old) return [];
        return old.filter((t) => !taskIds.includes(t.taskId));
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["project-tasks", projectId], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
};
