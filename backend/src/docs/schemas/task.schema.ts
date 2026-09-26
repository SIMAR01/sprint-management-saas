/**
 * Reusable OpenAPI Component Schemas for Tasks & Task Event-Sourcing
 * Strictly aligned with task.model.ts, taskEvent.model.ts, and task.validation.ts.
 */
export const taskSchemas = {
  // Kanban Column Status Enum
  TaskStatus: {
    type: "string",
    enum: ["todo", "inprogress", "underreview", "done"],
    description: "Current sprint workflow status / Kanban board column",
    example: "todo",
  },

  // Assignee Profile Preview (Enriched View)
  TaskAssignee: {
    type: "object",
    nullable: true,
    properties: {
      name: {
        type: "string",
        example: "Jane Doe",
      },
      username: {
        type: "string",
        example: "janedoe",
      },
      email: {
        type: "string",
        format: "email",
        example: "jane@example.com",
      },
    },
  },

  // Full Task Document Object
  Task: {
    type: "object",
    required: ["taskId", "projectId", "title", "status", "isDeleted", "createdAt", "updatedAt"],
    properties: {
      taskId: {
        type: "string",
        format: "uuid",
        description: "Stable unique UUID identifier for the task",
        example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
      },
      projectId: {
        type: "string",
        format: "uuid",
        description: "Parent project workspace UUID identifier",
        example: "8ea38a6a-d248-43df-973f-c399b38c2317",
      },
      title: {
        type: "string",
        description: "Task title / summary",
        example: "Design responsive Kanban board UI",
      },
      description: {
        type: "string",
        nullable: true,
        description: "Detailed task description and requirements",
        example: "Implement column layout with drag-and-drop preview",
      },
      assigneeId: {
        type: "string",
        format: "uuid",
        nullable: true,
        description: "UUID of assigned member (null if unassigned)",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      assignee: {
        $ref: "#/components/schemas/TaskAssignee",
      },
      status: {
        $ref: "#/components/schemas/TaskStatus",
      },
      images: {
        type: "array",
        items: {
          type: "string",
          format: "uri",
        },
        description: "Array of Cloudinary image/proof URLs — mandatory for 'done' status",
        example: [
          "https://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/screenshot1.png",
        ],
      },
      videoUrl: {
        type: "string",
        format: "uri",
        nullable: true,
        description: "Optional demonstration video URL (e.g. Cloudinary video, Loom, YouTube)",
        example: "https://www.loom.com/share/abcdef1234567890",
      },
      isDeleted: {
        type: "boolean",
        description: "Soft-delete flag",
        example: false,
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T14:00:00.000Z",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T14:30:00.000Z",
      },
    },
  },

  // Payload for Creating a Task
  CreateTaskRequest: {
    type: "object",
    required: ["title"],
    properties: {
      title: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Task summary / title",
        example: "Implement JWT refresh token rotation",
      },
      description: {
        type: "string",
        maxLength: 2000,
        description: "Optional description of the task",
        example: "Add cookie-based rotating refresh tokens with 7 days lifetime.",
      },
      assigneeId: {
        type: "string",
        format: "uuid",
        description: "UUID of the workspace member assigned to this task",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      status: {
        $ref: "#/components/schemas/TaskStatus",
        default: "todo",
      },
      images: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "Array of uploaded Cloudinary image/proof URLs. Strictly mandatory if status is 'done'. Optional for 'todo', 'inprogress', 'underreview'.",
        example: [
          "https://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/screenshot1.png",
        ],
      },
      videoUrl: {
        type: "string",
        format: "uri",
        nullable: true,
        description: "Optional demonstration video URL (e.g. Cloudinary video, Loom, YouTube)",
        example: "https://www.loom.com/share/abcdef1234567890",
      },
    },
  },

  // Payload for Updating a Task
  UpdateTaskRequest: {
    type: "object",
    properties: {
      title: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Updated title",
        example: "Implement Redis-backed refresh token rotation",
      },
      description: {
        type: "string",
        maxLength: 2000,
        nullable: true,
        description: "Updated description (pass null to clear)",
        example: "Refactored session store with automatic reuse detection",
      },
      assigneeId: {
        type: "string",
        format: "uuid",
        nullable: true,
        description: "Updated assignee UUID (pass null to unassign)",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      status: {
        $ref: "#/components/schemas/TaskStatus",
        description: "Updated status. If setting to 'done', task must have at least one image/screenshot proof attached.",
      },
      images: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Updated array of image/document proof URLs. Required to be non-empty when status is 'done'.",
        example: [
          "https://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/proof1.png",
        ],
      },
      videoUrl: {
        type: "string",
        format: "uri",
        nullable: true,
        description: "Updated demonstration video URL (pass null to clear)",
        example: "https://www.loom.com/share/abcdef1234567890",
      },
    },
  },

  // File Upload Result
  FileUploadResult: {
    type: "object",
    required: ["url", "secureUrl", "publicId", "format", "resourceType", "bytes"],
    properties: {
      url: {
        type: "string",
        example: "http://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/screenshot.png",
      },
      secureUrl: {
        type: "string",
        example: "https://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/screenshot.png",
      },
      publicId: {
        type: "string",
        example: "teamflow/projects/8ea38a6a/tasks/screenshot",
      },
      format: {
        type: "string",
        example: "png",
      },
      resourceType: {
        type: "string",
        example: "image",
      },
      bytes: {
        type: "integer",
        example: 245800,
      },
      originalFilename: {
        type: "string",
        example: "screenshot.png",
      },
    },
  },

  // File Upload Response (200) - supports single and multiple uploads
  FileUploadResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "File(s) uploaded successfully to Cloudinary",
      },
      data: {
        type: "object",
        properties: {
          url: {
            type: "string",
            example: "https://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/screenshot.png",
          },
          secureUrl: {
            type: "string",
            example: "https://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/screenshot.png",
          },
          publicId: {
            type: "string",
            example: "teamflow/projects/8ea38a6a/tasks/screenshot",
          },
          format: {
            type: "string",
            example: "png",
          },
          resourceType: {
            type: "string",
            example: "image",
          },
          bytes: {
            type: "integer",
            example: 245800,
          },
          originalFilename: {
            type: "string",
            example: "screenshot.png",
          },
          files: {
            type: "array",
            items: {
              $ref: "#/components/schemas/FileUploadResult",
            },
            description: "List of uploaded file metadata objects",
          },
        },
      },
    },
  },

  // Delete Attachment Request
  DeleteAttachmentRequest: {
    type: "object",
    required: ["publicId"],
    properties: {
      publicId: {
        type: "string",
        description: "Cloudinary asset public ID to delete",
        example: "teamflow/projects/8ea38a6a/tasks/screenshot_abc123",
      },
      resourceType: {
        type: "string",
        enum: ["image", "raw", "video", "auto"],
        default: "auto",
        description: "Asset resource type (image, raw for PDF, video, or auto)",
        example: "image",
      },
      taskId: {
        type: "string",
        format: "uuid",
        description: "Optional task UUID to detach this attachment from in the database",
        example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
      },
      fileUrl: {
        type: "string",
        description: "Optional specific file URL to detach from the task document",
        example: "https://res.cloudinary.com/teamflow/image/upload/v1721131200/teamflow/projects/8ea38a6a/tasks/screenshot.png",
      },
    },
  },

  // Delete Attachment Response (200)
  DeleteAttachmentResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Attachment deleted successfully from Cloudinary",
      },
      data: {
        type: "object",
        properties: {
          publicId: {
            type: "string",
            example: "teamflow/projects/8ea38a6a/tasks/screenshot_abc123",
          },
          result: {
            type: "string",
            example: "ok",
          },
          taskId: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
          },
          task: {
            $ref: "#/components/schemas/Task",
            nullable: true,
          },
        },
      },
    },
  },

  // Payload for Bulk Delete Tasks
  BulkDeleteTasksRequest: {
    type: "object",
    required: ["taskIds"],
    properties: {
      taskIds: {
        type: "array",
        minItems: 1,
        items: {
          type: "string",
          format: "uuid",
        },
        description: "List of task UUIDs to soft-delete",
        example: [
          "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
          "f39ed235-8c0d-59cf-0c27-f68db43e07d5",
        ],
      },
    },
  },

  // Pagination Metadata Object
  PaginationMeta: {
    type: "object",
    required: ["page", "limit", "total", "totalPages"],
    properties: {
      page: {
        type: "integer",
        description: "Current page number",
        example: 1,
      },
      limit: {
        type: "integer",
        description: "Records per page",
        example: 20,
      },
      total: {
        type: "integer",
        description: "Total count of matching tasks",
        example: 45,
      },
      totalPages: {
        type: "integer",
        description: "Total available pages",
        example: 3,
      },
    },
  },

  // Paginated Tasks Result Wrapper
  PaginatedTasksData: {
    type: "object",
    required: ["tasks", "pagination"],
    properties: {
      tasks: {
        type: "array",
        items: {
          $ref: "#/components/schemas/Task",
        },
      },
      pagination: {
        $ref: "#/components/schemas/PaginationMeta",
      },
    },
  },

  // Paginated Tasks Response
  PaginatedTasksResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Project tasks retrieved successfully",
      },
      data: {
        $ref: "#/components/schemas/PaginatedTasksData",
      },
    },
  },

  // Single Task Response (200)
  TaskSuccessResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Task updated successfully",
      },
      data: {
        $ref: "#/components/schemas/Task",
      },
    },
  },

  // Task Created Response (201)
  TaskCreatedResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 201,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Task created successfully",
      },
      data: {
        $ref: "#/components/schemas/Task",
      },
    },
  },

  // Task Event Item in History
  TaskEventItem: {
    type: "object",
    required: ["eventId", "taskId", "projectId", "userId", "eventType", "payload", "timestamp"],
    properties: {
      eventId: {
        type: "string",
        format: "uuid",
        example: "b12dc124-7b9c-48be-9b16-e57ca32d96c4",
      },
      taskId: {
        type: "string",
        format: "uuid",
        example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
      },
      projectId: {
        type: "string",
        format: "uuid",
        example: "8ea38a6a-d248-43df-973f-c399b38c2317",
      },
      userId: {
        type: "string",
        format: "uuid",
        description: "User UUID of actor who triggered the task change",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      eventType: {
        type: "string",
        enum: ["TASK_CREATED", "STATUS_CHANGED", "TASK_DELETED", "ASSIGNEE_CHANGED", "TASK_UPDATED"],
        example: "STATUS_CHANGED",
      },
      payload: {
        type: "object",
        description: "State diff and event metadata",
        example: {
          previousStatus: "todo",
          newStatus: "inprogress",
          title: "Implement JWT refresh token rotation",
        },
      },
      timestamp: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T15:00:00.000Z",
      },
      actor: {
        type: "object",
        properties: {
          name: { type: "string", example: "Jane Doe" },
          username: { type: "string", example: "janedoe" },
          email: { type: "string", example: "jane@example.com" },
        },
      },
    },
  },

  // Task Events List Response
  TaskEventsResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Task event history retrieved successfully",
      },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/TaskEventItem",
        },
      },
    },
  },

  // Task Delete Response
  TaskDeleteResponse: {
    type: "object",
    required: ["statusCode", "success", "message", "data"],
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Task deleted successfully",
      },
      data: {
        type: "object",
        nullable: true,
        example: null,
      },
    },
  },
};
