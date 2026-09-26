/**
 * Reusable OpenAPI Component Schemas for Project Workspaces & Memberships
 * Strictly aligned with project.model.ts, projectEvent.model.ts, and project.validation.ts.
 */
export const projectSchemas = {
  // Member in a Project Workspace
  ProjectMember: {
    type: "object",
    required: ["userId", "role"],
    properties: {
      userId: {
        type: "string",
        format: "uuid",
        description: "Unique user UUID identifier",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      role: {
        type: "string",
        enum: ["ProjectManager", "TeamMember"],
        description: "RBAC role within this project workspace",
        example: "ProjectManager",
      },
      name: {
        type: "string",
        description: "Full name of the member (populated in enriched views)",
        example: "Jane Doe",
      },
      username: {
        type: "string",
        description: "Username of the member (populated in enriched views)",
        example: "janedoe",
      },
      email: {
        type: "string",
        format: "email",
        description: "Email address of the member (populated in enriched views)",
        example: "jane@example.com",
      },
    },
  },

  // Full Project Workspace Object
  Project: {
    type: "object",
    required: ["projectId", "name", "owner", "members", "isArchived", "isDeleted", "createdAt", "updatedAt"],
    properties: {
      projectId: {
        type: "string",
        format: "uuid",
        description: "Stable unique UUID identifier for the project workspace",
        example: "8ea38a6a-d248-43df-973f-c399b38c2317",
      },
      name: {
        type: "string",
        description: "Unique workspace name",
        example: "Phoenix Rebirth Engine",
      },
      description: {
        type: "string",
        nullable: true,
        description: "Optional description of the project workspace goals",
        example: "Next-gen deployment scheduling infrastructure",
      },
      owner: {
        type: "string",
        format: "uuid",
        description: "UUID of the creator / project owner",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      ownerName: {
        type: "string",
        description: "Owner full name (in enriched views)",
        example: "Simarjeet Kaur",
      },
      ownerUsername: {
        type: "string",
        description: "Owner username (in enriched views)",
        example: "simarjeet",
      },
      ownerEmail: {
        type: "string",
        format: "email",
        description: "Owner email (in enriched views)",
        example: "simarjeet@example.com",
      },
      members: {
        type: "array",
        description: "List of project members and their assigned roles",
        items: {
          $ref: "#/components/schemas/ProjectMember",
        },
      },
      isArchived: {
        type: "boolean",
        description: "Indicates whether the workspace is archived (read-only state)",
        example: false,
      },
      isDeleted: {
        type: "boolean",
        description: "Indicates whether the workspace has been soft-deleted",
        example: false,
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T12:00:00.000Z",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T12:30:00.000Z",
      },
    },
  },

  // Payload for Creating a Project
  CreateProjectRequest: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        minLength: 3,
        maxLength: 100,
        description: "Unique name of the project workspace (3 to 100 characters)",
        example: "Phoenix Rebirth Engine",
      },
      description: {
        type: "string",
        maxLength: 500,
        description: "Optional project description (maximum 500 characters)",
        example: "Next-gen deployment scheduling infrastructure",
      },
    },
  },

  // Payload for Updating a Project
  UpdateProjectRequest: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 3,
        maxLength: 100,
        description: "Updated unique name of the project workspace",
        example: "Phoenix Rebirth v2",
      },
      description: {
        type: "string",
        maxLength: 500,
        description: "Updated description of the project workspace",
        example: "Refined deployment pipeline engine",
      },
    },
  },

  // Payload for Inviting a Member
  InviteMemberRequest: {
    type: "object",
    required: ["emailOrUsername", "role"],
    properties: {
      emailOrUsername: {
        type: "string",
        description: "Email address or username of the user to invite",
        example: "jane@example.com",
      },
      role: {
        type: "string",
        enum: ["ProjectManager", "TeamMember"],
        description: "Role assigned to the invited member",
        example: "TeamMember",
      },
    },
  },

  // Payload for Removing a Member
  RemoveMemberRequest: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: {
        type: "string",
        format: "uuid",
        description: "Unique user UUID of the member to remove from workspace",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
    },
  },

  // Single Project Success Response
  ProjectSuccessResponse: {
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
        example: "Project workspace retrieved successfully",
      },
      data: {
        $ref: "#/components/schemas/Project",
      },
    },
  },

  // Created Project Response (201)
  ProjectCreatedResponse: {
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
        example: "Project workspace created successfully",
      },
      data: {
        $ref: "#/components/schemas/Project",
      },
    },
  },

  // Multiple Projects List Response
  ProjectListResponse: {
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
        example: "User project workspaces retrieved successfully",
      },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/Project",
        },
      },
    },
  },

  // Project Event Item in Activity Timeline
  ProjectEventItem: {
    type: "object",
    required: ["eventId", "projectId", "eventType", "payload", "actorId", "timestamp"],
    properties: {
      id: {
        type: "string",
        example: "c79fbcf4-749e-4c7b-b5ea-1dd819ab2697",
      },
      eventId: {
        type: "string",
        format: "uuid",
        example: "c79fbcf4-749e-4c7b-b5ea-1dd819ab2697",
      },
      projectId: {
        type: "string",
        format: "uuid",
        example: "8ea38a6a-d248-43df-973f-c399b38c2317",
      },
      eventType: {
        type: "string",
        enum: [
          "PROJECT_CREATED",
          "PROJECT_UPDATED",
          "PROJECT_ARCHIVED",
          "PROJECT_DELETED",
          "MEMBER_INVITED",
          "MEMBER_REMOVED",
          "TASK_CREATED",
          "STATUS_CHANGED",
          "TASK_DELETED",
          "ASSIGNEE_CHANGED",
          "TASK_UPDATED",
        ],
        example: "PROJECT_CREATED",
      },
      payload: {
        type: "object",
        description: "Dynamic metadata payload capturing event details and field diffs",
        example: {
          name: "Phoenix Rebirth Engine",
          description: "Next-gen deployment scheduler",
          ownerId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        },
      },
      actorId: {
        type: "string",
        format: "uuid",
        description: "User UUID of the actor who performed the action",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      timestamp: {
        type: "string",
        format: "date-time",
        example: "2026-07-16T12:00:00.000Z",
      },
      actor: {
        type: "object",
        properties: {
          name: { type: "string", example: "Simarjeet Kaur" },
          username: { type: "string", example: "simarjeet" },
          email: { type: "string", example: "simarjeet@example.com" },
        },
      },
    },
  },

  // Project Timeline Response
  ProjectTimelineResponse: {
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
        example: "Project timeline activity retrieved successfully",
      },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/ProjectEventItem",
        },
      },
    },
  },

  // Generic Null Data Operation Response (e.g. Delete)
  ProjectDeleteResponse: {
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
        example: "Project workspace deleted successfully",
      },
      data: {
        type: "object",
        nullable: true,
        example: null,
      },
    },
  },
};
