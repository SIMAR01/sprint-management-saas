/**
 * OpenAPI 3.0 Path Definitions for Project Workspace Endpoints
 * Kept completely decoupled from business logic and route handlers.
 */
export const projectDocs = {
  "/api/v1/projects": {
    get: {
      tags: ["Projects"],
      summary: "List user project workspaces",
      description:
        "Retrieves all active project workspaces where the authenticated user is either the owner or an assigned team member. Enriched with owner and member user profiles.",
      operationId: "getUserProjects",
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: "Project workspaces retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectListResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },

    post: {
      tags: ["Projects"],
      summary: "Create a new project workspace",
      description:
        "Creates a new project workspace. The authenticated creator automatically becomes the workspace owner and is assigned the 'ProjectManager' role in the members collection. Generates an immutable audit event log ('PROJECT_CREATED') and broadcasts real-time 'project:created' socket events.",
      operationId: "createProject",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "x-idempotency-key",
          in: "header",
          required: false,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Optional idempotency key to prevent duplicate creation on client retries",
          example: "a8b9c0d1-e2f3-4a5b-6c7d-8e9f0a1b2c3d",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/CreateProjectRequest",
            },
            example: {
              name: "Phoenix Rebirth Engine",
              description: "Next-gen deployment scheduling infrastructure",
            },
          },
        },
      },
      responses: {
        201: {
          description: "Project workspace created successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectCreatedResponse",
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
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/projects/created": {
    get: {
      tags: ["Projects"],
      summary: "List owned project workspaces",
      description:
        "Retrieves all active workspaces created and owned by the authenticated user. Enriched with owner and member user profiles.",
      operationId: "getOwnedProjects",
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: "Owned project workspaces retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectListResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/projects/{projectId}": {
    get: {
      tags: ["Projects"],
      summary: "Get workspace details",
      description:
        "Retrieves complete details of a specific project workspace. Access is strictly verified by membership middleware.",
      operationId: "getProjectDetails",
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
          description: "Project workspace details retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectSuccessResponse",
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

    put: {
      tags: ["Projects"],
      summary: "Update project workspace metadata",
      description:
        "Updates name and description for an existing workspace. Restricted to users with the 'ProjectManager' role. Records a 'PROJECT_UPDATED' event log with before/after state diff and broadcasts 'project:updated' socket events to all room members. Cannot edit an archived workspace.",
      operationId: "updateProject",
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
          description: "Optional idempotency key to prevent duplicate updates",
          example: "b9c0d1e2-f3a4-5b6c-7d8e-9f0a1b2c3d4e",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UpdateProjectRequest",
            },
            example: {
              name: "Phoenix Rebirth v2",
              description: "Refined deployment pipeline engine",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Project workspace updated successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectSuccessResponse",
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
      tags: ["Projects"],
      summary: "Delete project workspace",
      description:
        "Deletes a project workspace. Restricted to users with the 'ProjectManager' role. If the project contains 0 tasks, it is permanently deleted; if it contains tasks, it is resiliently soft-deleted (`isDeleted: true`) and all tasks are soft-deleted. Emits 'project:deleted' socket event.",
      operationId: "deleteProject",
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
          example: "c0d1e2f3-a4b5-6c7d-8e9f-0a1b2c3d4e5f",
        },
      ],
      responses: {
        200: {
          description: "Project workspace deleted successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectDeleteResponse",
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

  "/api/v1/projects/{projectId}/archive": {
    post: {
      tags: ["Projects"],
      summary: "Archive project workspace",
      description:
        "Marks a workspace as archived (`isArchived: true`), putting it into a read-only state. Restricted to 'ProjectManager' role. Prevents mutations and member invites. Emits 'project:archived' socket event.",
      operationId: "archiveProject",
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
          example: "d1e2f3a4-b56c-7d8e-9f0a-1b2c3d4e5f6a",
        },
      ],
      responses: {
        200: {
          description: "Project workspace archived successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectSuccessResponse",
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

  "/api/v1/projects/{projectId}/invite": {
    post: {
      tags: ["Projects"],
      summary: "Invite member to project workspace",
      description:
        "Invites an existing registered user to the workspace by their email address or username. Restricted to 'ProjectManager' role. Records a 'MEMBER_INVITED' event, broadcasts 'member:invited' to room members, and sends 'workspace:invited' directly to the invitee's active WebSocket connection. Cannot invite to archived workspaces.",
      operationId: "inviteMember",
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
          example: "e2f3a4b5-6c7d-8e9f-0a1b-2c3d4e5f6a7b",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/InviteMemberRequest",
            },
            example: {
              emailOrUsername: "jane@example.com",
              role: "TeamMember",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Member invited successfully to workspace",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectSuccessResponse",
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
        409: {
          $ref: "#/components/responses/Conflict",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/projects/{projectId}/remove": {
    post: {
      tags: ["Projects"],
      summary: "Remove member from project workspace",
      description:
        "Removes a member from the project workspace. Restricted to 'ProjectManager' role. Workspace owners cannot be removed. Records a 'MEMBER_REMOVED' event, broadcasts 'member:removed' to room members, and forcefully evicts the removed member's active WebSocket sessions with 'workspace:evicted'.",
      operationId: "removeMember",
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
          example: "f3a4b56c-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/RemoveMemberRequest",
            },
            example: {
              userId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Member removed successfully from workspace",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectSuccessResponse",
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

  "/api/v1/projects/{projectId}/activity": {
    get: {
      tags: ["Projects"],
      summary: "Fetch workspace chronological activity timeline",
      description:
        "Retrieves a combined chronological activity feed containing both workspace-level events and task-level mutations. All events are enriched with the actor's profile details.",
      operationId: "getProjectTimeline",
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
          description: "Project timeline activity retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectTimelineResponse",
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
