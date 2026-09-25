/**
 * Reusable Standard OpenAPI Response Components
 * Formatted to match the backend's ApiError and centralized error middleware.
 */
export const commonResponses = {
  BadRequest: {
    description: "Bad Request - Invalid request payload, malformed JSON, or missing required fields",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "All fields are required",
          errors: [],
          stack: null,
        },
      },
    },
  },

  ValidationError: {
    description: "Validation Failed - One or more fields failed schema validation rules (e.g. invalid email, short password)",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "Validation failed",
          errors: [
            {
              field: "email",
              message: "Invalid email address",
            },
            {
              field: "password",
              message: "Password must be at least 6 characters",
            },
          ],
          stack: null,
        },
      },
    },
  },

  Unauthorized: {
    description: "Unauthorized - Authentication required, token missing, token expired, invalid signature, or blacklisted token",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "Not authorized, token missing",
          errors: [],
          stack: null,
        },
      },
    },
  },

  Forbidden: {
    description: "Forbidden - The user is authenticated but does not possess required permissions for this action",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "You do not have permission to perform this action",
          errors: [],
          stack: null,
        },
      },
    },
  },

  NotFound: {
    description: "Not Found - The requested resource or route does not exist",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "User not found",
          errors: [],
          stack: null,
        },
      },
    },
  },

  Conflict: {
    description: "Conflict - A resource with the specified unique attributes already exists (e.g. email or username)",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "User with this email or username already exists",
          errors: [],
          stack: null,
        },
      },
    },
  },

  TooManyRequests: {
    description: "Too Many Requests - Rate limit exceeded (sliding window rate limit: max 100 requests per 15 minutes)",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "Too many authentication attempts, please try again later",
          errors: [],
          stack: null,
        },
      },
    },
  },

  InternalServerError: {
    description: "Internal Server Error - Unexpected unhandled exception encountered by the server",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/ApiError",
        },
        example: {
          success: false,
          message: "Something went wrong",
          errors: [],
          stack: null,
        },
      },
    },
  },
};
