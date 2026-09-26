export const auditDocs = {
  "/api/v1/audit": {
    get: {
      tags: ["Audit Logs"],
      summary: "Query Global Audit Logs",
      description: "Retrieves a paginated list of immutable audit log events across projects, tasks, and user authentication lifecycles.",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "resourceId",
          in: "query",
          description: "Filter by resource ID (project ID, task ID, etc.)",
          schema: { type: "string" },
        },
        {
          name: "resourceType",
          in: "query",
          description: "Filter by resource type (PROJECT, TASK, USER, SESSION)",
          schema: { type: "string" },
        },
        {
          name: "actorUserId",
          in: "query",
          description: "Filter by actor user ID",
          schema: { type: "string" },
        },
        {
          name: "action",
          in: "query",
          description: "Filter by audit action (e.g., TASK_STATUS_UPDATED, PROJECT_CREATED)",
          schema: { type: "string" },
        },
        {
          name: "correlationId",
          in: "query",
          description: "Filter by request correlation ID for end-to-end trace auditing",
          schema: { type: "string" },
        },
        {
          name: "page",
          in: "query",
          description: "Page number for pagination",
          schema: { type: "integer", default: 1 },
        },
        {
          name: "limit",
          in: "query",
          description: "Number of logs per page (max 100)",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        "200": {
          description: "Audit logs retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AuditLogResponse",
              },
            },
          },
        },
        "401": {
          $ref: "#/components/responses/Unauthorized",
        },
      },
    },
  },
  "/api/v1/projects/{projectId}/audit": {
    get: {
      tags: ["Audit Logs"],
      summary: "Query Project-Scoped Audit Logs",
      description: "Retrieves immutable audit logs scoped specifically to a project workspace.",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "projectId",
          in: "path",
          required: true,
          description: "The unique project UUID",
          schema: { type: "string" },
        },
        {
          name: "action",
          in: "query",
          description: "Filter by audit action",
          schema: { type: "string" },
        },
        {
          name: "page",
          in: "query",
          description: "Page number",
          schema: { type: "integer", default: 1 },
        },
        {
          name: "limit",
          in: "query",
          description: "Page size limit",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        "200": {
          description: "Project audit logs retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AuditLogResponse",
              },
            },
          },
        },
        "401": {
          $ref: "#/components/responses/Unauthorized",
        },
        "403": {
          $ref: "#/components/responses/Forbidden",
        },
        "404": {
          $ref: "#/components/responses/NotFound",
        },
      },
    },
  },
};
