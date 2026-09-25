/**
 * Reusable Common OpenAPI Component Schemas
 * Standardized across all SaaS API modules.
 */
export const commonSchemas = {
  // Generic standard success response wrapper
  ApiResponse: {
    type: "object",
    required: ["statusCode", "success", "message"],
    properties: {
      statusCode: {
        type: "integer",
        description: "HTTP status code of the response",
        example: 200,
      },
      success: {
        type: "boolean",
        description: "Indicates if the request was successful (statusCode < 400)",
        example: true,
      },
      message: {
        type: "string",
        description: "Human-readable summary of the operation outcome",
        example: "Operation completed successfully",
      },
      data: {
        type: "object",
        description: "Payload data returned by the endpoint (null or object or array)",
      },
    },
  },

  // Detailed validation error item (from Zod or Mongoose validation)
  ValidationErrorDetail: {
    type: "object",
    required: ["field", "message"],
    properties: {
      field: {
        type: "string",
        description: "Name or path of the parameter/body field that failed validation",
        example: "email",
      },
      message: {
        type: "string",
        description: "Explanation of why the field value was rejected",
        example: "Invalid email address",
      },
    },
  },

  // Standard operational error payload produced by centralized error handler
  ApiError: {
    type: "object",
    required: ["success", "message", "errors", "stack"],
    properties: {
      success: {
        type: "boolean",
        description: "Always false for error responses",
        example: false,
      },
      message: {
        type: "string",
        description: "Descriptive error message",
        example: "Invalid credentials provided",
      },
      errors: {
        type: "array",
        description: "Array of detailed validation or operational error items",
        items: {
          $ref: "#/components/schemas/ValidationErrorDetail",
        },
        example: [],
      },
      stack: {
        type: "string",
        nullable: true,
        description: "Error call stack. Populated in development environment; null in production.",
        example: null,
      },
    },
  },

  // System Health Check Response
  HealthCheckResponse: {
    type: "object",
    required: ["success", "message"],
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Server is healthy",
      },
    },
  },
};
