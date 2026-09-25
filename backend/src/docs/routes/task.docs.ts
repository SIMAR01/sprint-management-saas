/**
 * OpenAPI 3.0 Path Definitions for Tasks & Task Event-Sourcing Endpoints
 * Kept completely decoupled from business logic and route handlers.
 */
export const taskDocs = {
  "/api/v1/projects/{projectId}/tasks": {
    get: {
      tags: ["Tasks"],
      summary: "Get paginated project tasks with Kanban column filter",
      description:
        "Returns a paginated list of non-deleted tasks inside the specified workspace. Supports query parameters for page, limit, and status column filtering. Enriched with assignee user profile metadata.",
      operationId: "getProjectTasks",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
        {
          name: "page",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
          description: "Page number for pagination",
          example: 1,
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          description: "Number of records per page",
          example: 20,
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            $ref: "#/components/schemas/TaskStatus",
          },
          description: "Filter tasks by Kanban board column status",
          example: "todo",
        },
      ],
      responses: {
        200: {
          description: "Project tasks retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PaginatedTasksResponse",
              },
            },
          },
        },
        400: {
          $ref: "#/components/responses/ValidationError",
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        403: {
          $ref: "#/components/responses/Forbidden",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },

    post: {
      tags: ["Tasks"],
      summary: "Create a new task in workspace",
      description:
        "Creates a new task within the project workspace. Inserts the read model, appends an immutable 'TASK_CREATED' event log (with dual-write compensation rollback on failure), and emits real-time 'task:created' socket events to all workspace members. Cannot create tasks in an archived workspace.",
      operationId: "createTask",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
        {
          name: "x-idempotency-key",
          in: "header",
          required: false,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Optional idempotency key to prevent duplicate creation on client retries",
          example: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/CreateTaskRequest",
            },
            example: {
              title: "Implement JWT refresh token rotation",
              description: "Add rotating HTTP-only cookies with automatic session invalidation.",
              assigneeId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
              status: "todo",
            },
          },
        },
      },
      responses: {
        201: {
          description: "Task created successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskCreatedResponse",
              },
            },
          },
        },
        400: {
          $ref: "#/components/responses/BadRequest",
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        403: {
          $ref: "#/components/responses/Forbidden",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/projects/{projectId}/tasks/events": {
    get: {
      tags: ["Tasks"],
      summary: "Get project-wide task event activity feed",
      description:
        "Returns chronological task event history across every task in the project workspace, enriched with the actor's profile data.",
      operationId: "getProjectTaskEvents",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
      ],
      responses: {
        200: {
          description: "Project task events retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskEventsResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        403: {
          $ref: "#/components/responses/Forbidden",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/projects/{projectId}/tasks/bulk": {
    delete: {
      tags: ["Tasks"],
      summary: "Bulk soft-delete tasks",
      description:
        "Soft-deletes multiple tasks at once by setting `isDeleted: true`. Appends 'TASK_DELETED' events to the event store and broadcasts 'task:bulk_deleted' real-time socket events.",
      operationId: "bulkDeleteTasks",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
        {
          name: "x-idempotency-key",
          in: "header",
          required: false,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Optional idempotency key",
          example: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/BulkDeleteTasksRequest",
            },
            example: {
              taskIds: [
                "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
                "f39ed235-8c0d-59cf-0c27-f68db43e07d5",
              ],
            },
          },
        },
      },
      responses: {
        200: {
          description: "Tasks deleted successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskDeleteResponse",
              },
            },
          },
        },
        400: {
          $ref: "#/components/responses/BadRequest",
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        403: {
          $ref: "#/components/responses/Forbidden",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/projects/{projectId}/tasks/{taskId}": {
    patch: {
      tags: ["Tasks"],
      summary: "Update task fields (title, description, assignee, status)",
      description:
        "Updates task metadata or status. Writes granular event logs ('TASK_UPDATED', 'ASSIGNEE_CHANGED', 'STATUS_CHANGED') to the event store with dual-write compensation rollback. Emits 'task:updated' (and 'task:status_changed' if status column changed) real-time socket events. Cannot modify tasks in an archived workspace.",
      operationId: "updateTask",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
        {
          name: "taskId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique task UUID",
          example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
        },
        {
          name: "x-idempotency-key",
          in: "header",
          required: false,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Optional idempotency key",
          example: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UpdateTaskRequest",
            },
            example: {
              status: "inprogress",
              description: "Refactored session store with automatic reuse detection",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Task updated successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskSuccessResponse",
              },
            },
          },
        },
        400: {
          $ref: "#/components/responses/BadRequest",
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        403: {
          $ref: "#/components/responses/Forbidden",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },

    delete: {
      tags: ["Tasks"],
      summary: "Soft-delete a task",
      description:
        "Soft-deletes a task by setting `isDeleted: true`. Appends a 'TASK_DELETED' event to the immutable log and emits 'task:deleted' socket event. Physical records are preserved for audit purposes.",
      operationId: "softDeleteTask",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
        {
          name: "taskId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique task UUID",
          example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
        },
        {
          name: "x-idempotency-key",
          in: "header",
          required: false,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Optional idempotency key",
          example: "d4e5f6a7-b89c-0d1e-2f3a-4b5c6d7e8f9a",
        },
      ],
      responses: {
        200: {
          description: "Task deleted successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskDeleteResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        403: {
          $ref: "#/components/responses/Forbidden",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/projects/{projectId}/tasks/{taskId}/events": {
    get: {
      tags: ["Tasks"],
      summary: "Get chronological event history for a single task",
      description:
        "Returns the complete event audit trail for a single task ('TASK_CREATED', 'STATUS_CHANGED', 'ASSIGNEE_CHANGED', 'TASK_UPDATED', 'TASK_DELETED'), enriched with actor profiles.",
      operationId: "getTaskEvents",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique project workspace UUID",
          example: "8ea38a6a-d248-43df-973f-c399b38c2317",
        },
        {
          name: "taskId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique task UUID",
          example: "e28dc124-7b9c-48be-9b16-e57ca32d96c4",
        },
      ],
      responses: {
        200: {
          description: "Task event history retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskEventsResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        403: {
          $ref: "#/components/responses/Forbidden",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },
};
