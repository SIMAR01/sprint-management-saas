export type TaskStatus = 'todo' | 'inprogress' | 'underreview' | 'done';

export interface Task {
  taskId: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assignee?: {
    name: string;
    username: string;
    email: string;
  } | null;
  status: TaskStatus;
  images: string[];
  videoUrl?: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedTasksResponse {
  statusCode: number;
  data: {
    tasks: Task[];
    pagination: PaginationMeta;
  };
  message: string;
  success: boolean;
}

export interface SingleTaskResponse {
  statusCode: number;
  data: Task;
  message: string;
  success: boolean;
}

export interface UploadedFileMeta {
  url: string;
  secureUrl: string;
  publicId: string;
  format?: string;
  resourceType: string;
  bytes: number;
  originalFilename?: string;
}

export interface FileUploadResponse {
  statusCode: number;
  data: {
    url?: string;
    secureUrl?: string;
    publicId?: string;
    resourceType?: string;
    files?: UploadedFileMeta[];
  };
  message: string;
  success: boolean;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigneeId?: string;
  status?: TaskStatus;
  images?: string[];
  videoUrl?: string | null;
}

export interface UpdateTaskStatusPayload {
  status: TaskStatus;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  status?: TaskStatus;
  images?: string[];
  videoUrl?: string | null;
}

export interface DeleteAttachmentPayload {
  publicId: string;
  resourceType?: 'image' | 'raw' | 'video' | 'auto';
  taskId?: string;
  fileUrl?: string;
}
