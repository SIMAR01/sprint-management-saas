/**
 * Reusable OpenAPI Component Schemas for Authentication & User Session Management
 * Strictly aligned with Zod validation rules and database models.
 */
export const authSchemas = {
  // Payload for User Registration (Signup)
  RegisterRequest: {
    type: "object",
    required: ["name", "username", "email", "password"],
    properties: {
      name: {
        type: "string",
        minLength: 2,
        maxLength: 50,
        description: "Full name of the user (2 to 50 characters, trimmed)",
        example: "Simarjeet Kaur",
      },
      username: {
        type: "string",
        minLength: 3,
        maxLength: 30,
        pattern: "^[a-zA-Z0-9_]+$",
        description: "Unique alphanumeric username (3 to 30 characters, lowercase, underscores allowed)",
        example: "simarjeet",
      },
      email: {
        type: "string",
        format: "email",
        description: "Unique and valid email address (lowercase, trimmed)",
        example: "simarjeet@example.com",
      },
      password: {
        type: "string",
        format: "password",
        minLength: 6,
        maxLength: 128,
        description: "Account password (minimum 6 characters, maximum 128 characters)",
        example: "SecureP@ssw0rd2026!",
      },
    },
  },

  // Payload for User Login
  LoginRequest: {
    type: "object",
    required: ["emailOrUsername", "password"],
    properties: {
      emailOrUsername: {
        type: "string",
        description: "Registered email address or username",
        example: "simarjeet@example.com",
      },
      password: {
        type: "string",
        format: "password",
        description: "Account password",
        example: "SecureP@ssw0rd2026!",
      },
    },
  },

  // Payload for Optional Logout Filtering
  LogoutRequest: {
    type: "object",
    properties: {
      all: {
        type: "boolean",
        description: "If true, revokes all active sessions across all devices for this user",
        default: false,
        example: false,
      },
      sessionId: {
        type: "string",
        format: "uuid",
        description: "Optional specific session UUID to terminate (e.g. logging out a secondary device)",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
    },
  },

  // Public user summary returned upon login
  UserPublic: {
    type: "object",
    required: ["id", "name", "username", "email"],
    properties: {
      id: {
        type: "string",
        description: "Unique UUID of the user",
        example: "e4b5c7d8-1234-4567-89ab-cdef01234567",
      },
      name: {
        type: "string",
        example: "Simarjeet Kaur",
      },
      username: {
        type: "string",
        example: "simarjeet",
      },
      email: {
        type: "string",
        format: "email",
        example: "simarjeet@example.com",
      },
    },
  },

  // Detailed User profile returned upon registration or profile retrieval
  UserProfile: {
    type: "object",
    required: ["_id", "uuid", "name", "username", "email", "createdAt", "updatedAt"],
    properties: {
      _id: {
        type: "string",
        description: "Internal MongoDB document ObjectId",
        example: "673f4e2f89a1c23456789abc",
      },
      uuid: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Canonical business UUID for the user",
            example: "e4b5c7d8-1234-4567-89ab-cdef01234567",
          },
        },
      },
      name: {
        type: "string",
        example: "Simarjeet Kaur",
      },
      username: {
        type: "string",
        example: "simarjeet",
      },
      email: {
        type: "string",
        format: "email",
        example: "simarjeet@example.com",
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-09-24T18:00:00.000Z",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        example: "2026-09-24T18:00:00.000Z",
      },
    },
  },

  // Login successful response payload data
  LoginData: {
    type: "object",
    required: ["user", "accessToken"],
    properties: {
      user: {
        $ref: "#/components/schemas/UserPublic",
      },
      accessToken: {
        type: "string",
        description: "Stateless short-lived JWT Access Token (15m expiry). Send in Authorization header: Bearer <token>",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU0YjVjN2Q4LTEyMzQtNDU2Ny04OWFiLWNkZWYwMTIzNDU2NyIsImVtYWlsIjoic2ltYXJqZWV0QGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJzaW1hcmplZXQiLCJpYXQiOjE3NTg3MzIwMDAsImV4cCI6MTc1ODczMjkwMH0.fake_signature_example",
      },
    },
  },

  // Token refresh successful response payload data
  RefreshTokenData: {
    type: "object",
    required: ["accessToken"],
    properties: {
      accessToken: {
        type: "string",
        description: "Newly generated JWT Access Token (15m expiry)",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU0YjVjN2Q4LTEyMzQtNDU2Ny04OWFiLWNkZWYwMTIzNDU2NyIsImVtYWlsIjoic2ltYXJqZWV0QGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJzaW1hcmplZXQiLCJpYXQiOjE3NTg3MzIwMDAsImV4cCI6MTc1ODczMjkwMH0.new_fake_signature_example",
      },
    },
  },

  // Active Session item representing a logged-in client device
  SessionItem: {
    type: "object",
    required: ["sessionId", "userId", "ip", "userAgent", "browser", "os", "device", "lastActive", "createdAt", "isCurrent"],
    properties: {
      sessionId: {
        type: "string",
        format: "uuid",
        description: "Unique UUID identifying the active session",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      userId: {
        type: "string",
        format: "uuid",
        example: "e4b5c7d8-1234-4567-89ab-cdef01234567",
      },
      ip: {
        type: "string",
        description: "IP address of the client device",
        example: "192.168.1.50",
      },
      userAgent: {
        type: "string",
        description: "Raw User-Agent string from the client header",
        example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      browser: {
        type: "string",
        description: "Parsed browser name and version",
        example: "Chrome",
      },
      os: {
        type: "string",
        description: "Parsed operating system",
        example: "Windows",
      },
      device: {
        type: "string",
        description: "Parsed device type (Desktop, Mobile, Tablet, etc.)",
        example: "Desktop",
      },
      lastActive: {
        type: "string",
        format: "date-time",
        description: "ISO timestamp of the most recent activity on this session",
        example: "2026-09-24T18:25:00.000Z",
      },
      createdAt: {
        type: "string",
        format: "date-time",
        description: "ISO timestamp when the session was initiated",
        example: "2026-09-24T12:00:00.000Z",
      },
      isCurrent: {
        type: "boolean",
        description: "Indicates whether this session matches the current caller's refresh token cookie",
        example: true,
      },
    },
  },

  // Logged out session item details returned after session revocation
  LoggedOutSessionItem: {
    type: "object",
    required: ["sessionId", "ip", "browser", "os", "device"],
    properties: {
      sessionId: {
        type: "string",
        format: "uuid",
        example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      userId: {
        type: "string",
        format: "uuid",
        example: "e4b5c7d8-1234-4567-89ab-cdef01234567",
      },
      ip: {
        type: "string",
        example: "192.168.1.50",
      },
      browser: {
        type: "string",
        example: "Chrome",
      },
      os: {
        type: "string",
        example: "Windows",
      },
      device: {
        type: "string",
        example: "Desktop",
      },
      lastActive: {
        type: "string",
        format: "date-time",
        example: "2026-09-24T18:25:00.000Z",
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-09-24T12:00:00.000Z",
      },
    },
  },

  // Logout successful response payload data
  LogoutData: {
    type: "object",
    required: ["loggedOutSessions"],
    properties: {
      loggedOutSessions: {
        type: "array",
        description: "List of sessions that were successfully invalidated",
        items: {
          $ref: "#/components/schemas/LoggedOutSessionItem",
        },
      },
    },
  },

  // Full Standard Responses
  RegisterSuccessResponse: {
    allOf: [
      { $ref: "#/components/schemas/ApiResponse" },
      {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 201 },
          success: { type: "boolean", example: true },
          message: { type: "string", example: "User registered successfully" },
          data: { $ref: "#/components/schemas/UserProfile" },
        },
      },
    ],
  },

  LoginSuccessResponse: {
    allOf: [
      { $ref: "#/components/schemas/ApiResponse" },
      {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 200 },
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Login successful" },
          data: { $ref: "#/components/schemas/LoginData" },
        },
      },
    ],
  },

  RefreshTokenSuccessResponse: {
    allOf: [
      { $ref: "#/components/schemas/ApiResponse" },
      {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 200 },
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Access token refreshed successfully" },
          data: { $ref: "#/components/schemas/RefreshTokenData" },
        },
      },
    ],
  },

  LogoutSuccessResponse: {
    allOf: [
      { $ref: "#/components/schemas/ApiResponse" },
      {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 200 },
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Logout successful" },
          data: { $ref: "#/components/schemas/LogoutData" },
        },
      },
    ],
  },

  ProfileSuccessResponse: {
    allOf: [
      { $ref: "#/components/schemas/ApiResponse" },
      {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 200 },
          success: { type: "boolean", example: true },
          message: { type: "string", example: "User profile fetched successfully" },
          data: { $ref: "#/components/schemas/UserProfile" },
        },
      },
    ],
  },

  SessionsSuccessResponse: {
    allOf: [
      { $ref: "#/components/schemas/ApiResponse" },
      {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 200 },
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Active sessions retrieved successfully" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/SessionItem" },
          },
        },
      },
    ],
  },
};
