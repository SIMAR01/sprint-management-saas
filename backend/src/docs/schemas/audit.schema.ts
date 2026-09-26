export const auditSchemas = {
  AuditActor: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      email: {
        type: "string",
        format: "email",
        example: "developer@teamflow.app",
      },
      role: {
        type: "string",
        example: "TeamMember",
      },
    },
  },
  AuditResource: {
    type: "object",
    properties: {
      type: {
        type: "string",
        example: "TASK",
      },
      id: {
        type: "string",
        example: "task-9b1deb4d-3b7d",
      },
      name: {
        type: "string",
        example: "Implement OAuth2 SSO",
      },
    },
  },
  AuditContext: {
    type: "object",
    properties: {
      ip: {
        type: "string",
        example: "192.168.1.1",
      },
      userAgent: {
        type: "string",
        example: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
      correlationId: {
        type: "string",
        example: "a4f80164-8b63-4c91-b3b3-85f2479e0a2f",
      },
    },
  },
  AuditDiff: {
    type: "object",
    properties: {
      before: {
        type: "object",
        example: { status: "in_progress" },
      },
      after: {
        type: "object",
        example: { status: "done" },
      },
    },
  },
  AuditLogItem: {
    type: "object",
    properties: {
      _id: {
        type: "string",
        example: "660c04f9829910d512a81234",
      },
      action: {
        type: "string",
        example: "TASK_STATUS_UPDATED",
      },
      actor: {
        $ref: "#/components/schemas/AuditActor",
      },
      resource: {
        $ref: "#/components/schemas/AuditResource",
      },
      context: {
        $ref: "#/components/schemas/AuditContext",
      },
      diff: {
        $ref: "#/components/schemas/AuditDiff",
      },
      metadata: {
        type: "object",
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-09-27T00:15:00.000Z",
      },
    },
  },
  AuditLogResponse: {
    type: "object",
    properties: {
      statusCode: {
        type: "integer",
        example: 200,
      },
      data: {
        type: "object",
        properties: {
          logs: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AuditLogItem",
            },
          },
          pagination: {
            type: "object",
            properties: {
              total: { type: "integer", example: 42 },
              page: { type: "integer", example: 1 },
              limit: { type: "integer", example: 20 },
              pages: { type: "integer", example: 3 },
            },
          },
        },
      },
      message: {
        type: "string",
        example: "Audit logs retrieved successfully",
      },
      success: {
        type: "boolean",
        example: true,
      },
    },
  },
};
