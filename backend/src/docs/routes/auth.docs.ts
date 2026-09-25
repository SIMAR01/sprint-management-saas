/**
 * OpenAPI 3.0 Path Definitions for Authentication Endpoints
 * Kept completely decoupled from business logic and route handlers.
 */
export const authDocs = {
  "/api/v1/auth/signup": {
    post: {
      tags: ["Authentication"],
      summary: "Register a new user",
      description:
        "Creates a new user account with unique credentials. Validates username, email format, and password length. Automatically hashes the password using bcrypt with 12 salt rounds before saving to MongoDB.",
      operationId: "registerUser",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/RegisterRequest",
            },
            example: {
              name: "Simarjeet Kaur",
              username: "simarjeet",
              email: "simarjeet@example.com",
              password: "SecureP@ssw0rd2026!",
            },
          },
        },
      },
      responses: {
        201: {
          description: "User registered successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterSuccessResponse",
              },
            },
          },
        },
        400: {
          $ref: "#/components/responses/ValidationError",
        },
        409: {
          $ref: "#/components/responses/Conflict",
        },
        429: {
          $ref: "#/components/responses/TooManyRequests",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },


  "/api/v1/auth/login": {
    post: {
      tags: ["Authentication"],
      summary: "User authentication & session creation",
      description:
        "Authenticates a user via email or username and password. On successful verification:\n" +
        "1. Generates a stateless 15-minute JWT Access Token returned in the JSON response body.\n" +
        "2. Generates a 7-day Refresh Token, persisted in Redis with device metadata (IP, User-Agent, OS, Browser, Device).\n" +
        "3. Sets an HTTP-Only, SameSite=Strict cookie named `refreshToken` in the client's browser (Secure flag enabled in production).\n" +
        "4. Fallback hashes the refresh token into MongoDB to guarantee high availability.\n" +
        "5. Automated Swagger UI Sync: The returned JWT Access Token is automatically captured and injected into Swagger UI's Bearer Authorization state.",
      operationId: "loginUser",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/LoginRequest",
            },
            example: {
              emailOrUsername: "simarjeet@example.com",
              password: "SecureP@ssw0rd2026!",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Login successful. Returns user profile, access token, and sets refreshToken cookie.",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string",
                example: "refreshToken=eyJhbGciOiJIUzI1Ni...; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800",
              },
              description: "HTTP-Only secure cookie containing the plain rotating refresh token (7 days TTL).",
            },
          },
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginSuccessResponse",
              },
            },
          },
        },
        400: {
          $ref: "#/components/responses/ValidationError",
        },
        401: {
          description: "Invalid credentials (wrong password or account not found)",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiError",
              },
              example: {
                success: false,
                message: "Invalid email/username or password",
                errors: [],
                stack: null,
              },
            },
          },
        },
        429: {
          $ref: "#/components/responses/TooManyRequests",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/auth/refresh-token": {
    post: {
      tags: ["Authentication"],
      summary: "Refresh access token via HTTP-Only cookie or body",
      description:
        "Rotates the user session and issues a fresh 15-minute JWT Access Token.\n\n" +
        "**Cookie-Based Refresh Flow & Security Invalidation**:\n" +
        "- Reads the `refreshToken` from the HTTP-Only cookie header (`Cookie: refreshToken=...`) or optional request body.\n" +
        "- Statelessly verifies token signature.\n" +
        "- Validates that the session exists in Redis (bypasses MongoDB for high performance).\n" +
        "- **Immediate Old Access Token Invalidation**: Any previous access token (tracked in the Redis session or provided in Authorization header) is instantly blacklisted in Redis (`blacklist:<token>`) with a TTL matching its remaining expiration. This completely forbids the previous access token from accessing protected endpoints like `/profile`.\n" +
        "- **Refresh Token Blacklisting**: The previous refresh token is recorded into the Redis blacklist (`blacklist:refresh:<token>`) to prevent replay attacks.\n" +
        "- **Automated Swagger UI Sync**: Swagger UI automatically captures the new rotated access token and updates its internal Authorization header.",
      operationId: "refreshToken",
      security: [
        {
          CookieAuth: [],
        },
        {
          BearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Access token refreshed successfully and new rotated cookie assigned.",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string",
                example: "refreshToken=new_rotated_token; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800",
              },
              description: "New rotated HTTP-Only refresh token cookie.",
            },
          },
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RefreshTokenSuccessResponse",
              },
            },
          },
        },
        401: {
          description: "Unauthorized - Refresh token missing, expired, revoked, or reuse detected",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiError",
              },
              examples: {
                missingToken: {
                  summary: "Missing Refresh Token",
                  value: {
                    success: false,
                    message: "Refresh token is missing",
                    errors: [],
                    stack: null,
                  },
                },
                revokedToken: {
                  summary: "Revoked Refresh Token",
                  value: {
                    success: false,
                    message: "Refresh token has been revoked. Please log in again.",
                    errors: [],
                    stack: null,
                  },
                },
                expiredToken: {
                  summary: "Expired Refresh Token",
                  value: {
                    success: false,
                    message: "Refresh token has expired",
                    errors: [],
                    stack: null,
                  },
                },
                tokenReuse: {
                  summary: "Potential Token Reuse Detected",
                  value: {
                    success: false,
                    message: "Invalid or expired session / potential reuse detected",
                    errors: [],
                    stack: null,
                  },
                },
              },
            },
          },
        },
        429: {
          $ref: "#/components/responses/TooManyRequests",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/auth/logout": {
    post: {
      tags: ["Authentication"],
      summary: "Logout user, invalidate session(s), and blacklist tokens",
      description:
        "Terminates user session(s) with multi-device support and strict token invalidation:\n\n" +
        "**Actions performed**:\n" +
        "1. **Access Token Blacklist**: Blacklists the current JWT Access Token in Redis (`blacklist:<token>`) with a TTL matching its remaining lifespan. Any subsequent calls with this token will return HTTP 401 Unauthorized.\n" +
        "2. **Refresh Token Blacklist**: Blacklists the current refresh token in Redis (`blacklist:refresh:<token>`) with a 7-day TTL to prevent token regeneration.\n" +
        "3. **Global Revocation (Logout All)**: If `all: true` in body: revokes all active Redis sessions, clears all refresh tokens in MongoDB, and records a global user revocation timestamp (`user:revoked_before:<userId>`) to immediately invalidate active access tokens across all devices.\n" +
        "4. **Specific Session Logout**: If `sessionId` in body: revokes that specific session from Redis and MongoDB.\n" +
        "5. **Cookie Cleanup**: Clears the HTTP-Only `refreshToken` cookie if logging out the current or all sessions.\n" +
        "6. **Automated Swagger UI Clear**: Automatically removes the Bearer Authorization token from Swagger UI and browser localStorage.",
      operationId: "logoutUser",
      security: [
        {
          BearerAuth: [],
        },
      ],
      requestBody: {
        required: false,
        description: "Optional parameters to control session termination scope",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/LogoutRequest",
            },
            examples: {
              currentSession: {
                summary: "Logout current session (Default)",
                value: {},
              },
              allSessions: {
                summary: "Logout all devices/sessions",
                value: {
                  all: true,
                },
              },
              specificSession: {
                summary: "Logout specific device session by ID",
                value: {
                  sessionId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Logout successful. Returns list of invalidated sessions.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LogoutSuccessResponse",
              },
            },
          },
        },
        400: {
          description: "Invalid session ID provided for this user",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiError",
              },
              example: {
                success: false,
                message: "Session ID is not valid for this user",
                errors: [],
                stack: null,
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        429: {
          $ref: "#/components/responses/TooManyRequests",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/auth/profile": {
    get: {
      tags: ["Authentication"],
      summary: "Get current user profile",
      description:
        "Returns the authenticated user's account details. Sensitive fields such as `password` and `refreshTokens` are stripped.",
      operationId: "getUserProfile",
      security: [
        {
          BearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "User profile fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProfileSuccessResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        404: {
          $ref: "#/components/responses/NotFound",
        },
        429: {
          $ref: "#/components/responses/TooManyRequests",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },

  "/api/v1/auth/sessions": {
    get: {
      tags: ["Authentication"],
      summary: "List all active user sessions",
      description:
        "Fetches all currently active sessions for the authenticated user from Redis. Displays parsed client information such as browser, operating system, device type, client IP, last active timestamp, and indicates which session belongs to the current caller (`isCurrent: true`).",
      operationId: "getUserActiveSessions",
      security: [
        {
          BearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Active sessions retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SessionsSuccessResponse",
              },
            },
          },
        },
        401: {
          $ref: "#/components/responses/Unauthorized",
        },
        429: {
          $ref: "#/components/responses/TooManyRequests",
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },
};
