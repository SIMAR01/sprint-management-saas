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
