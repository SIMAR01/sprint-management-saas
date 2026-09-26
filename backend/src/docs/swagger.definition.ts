import { env } from "../config/env";
import { commonSchemas } from "./schemas/common.schema";
import { authSchemas } from "./schemas/auth.schema";
import { projectSchemas } from "./schemas/project.schema";
import { taskSchemas } from "./schemas/task.schema";
import { notificationSchemas } from "./schemas/notification.schema";
import { commonResponses } from "./responses/common.responses";
import { securitySchemes } from "./security/security";
import { apiPaths } from "./routes/index";

/**
 * Production-Grade OpenAPI 3.0.3 Specification Definition.
 * Assembled from modular components: schemas, responses, security, and routes.
 */
export const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: env.API_TITLE,
    version: env.API_VERSION,
    description: `
## Overview
Welcome to the **${env.API_TITLE}** RESTful API documentation. 
This is a production-grade backend engine powering sprint management, multi-tenant collaboration, and agile task tracking for modern engineering teams.

---

### Authentication & Token Architecture
The platform enforces a dual-token security model with real-time multi-device session management:

1. **Access Token (JWT)**
   - Short-lived stateless token (**15 minutes** lifetime).
   - Transmitted in the standard HTTP \`Authorization\` header:
     \`\`\`http
     Authorization: Bearer <your_access_token>
     \`\`\`
   - On logout, access tokens are instantly blacklisted in Redis for their remaining TTL.

2. **Refresh Token (Rotating HTTP-Only Cookie)**
   - Long-lived token (**7 days** lifetime) stored strictly in an **HTTP-Only, SameSite=Strict** cookie named \`refreshToken\`.
   - Each login generates a distinct \`sessionId\` (UUID).
   - Sessions are cached in Redis under \`session:{userId}:{sessionId}\` with detailed device and browser fingerprints.
   - When refreshed at \`POST /api/v1/auth/refresh-token\`, the token is rotated (the old token is invalidated and a fresh one is issued).
   - Automatic token reuse detection clears all sessions immediately if an already-rotated token is presented.

---

### Idempotency & Resiliency Engine
- Write operations (\`POST\`, \`PUT\`, \`PATCH\`, \`DELETE\`) accept an optional header: \`X-Idempotency-Key: <UUID>\`.
- Prevents duplicate executions on network retries using deterministic SHA-256 payload hashing and Redis response caching (300s TTL).

---

### How to Test Protected Endpoints in Swagger UI
1. Call \`POST /api/v1/auth/signup\` or \`POST /api/v1/auth/login\` with test credentials.
2. Copy the \`accessToken\` from the JSON response.
3. Click the green **Authorize** button at the top-right of this page.
4. Enter \`Bearer <accessToken>\` or simply paste your JWT into the \`BearerAuth\` input and click **Authorize**.
5. You can now execute protected endpoints (such as \`GET /api/v1/projects\` and \`GET /api/v1/projects/:projectId/tasks\`) using **Try it out**!
    `,
    contact: {
      name: "TeamFlow Engineering Team",
      email: "support@teamflow.internal",
    },
    license: {
      name: "Proprietary",
    },
  },
  servers: [
    {
      url: env.SWAGGER_SERVER_URL,
      description: `${env.NODE_ENV.toUpperCase()} Server`,
    },
    ...(env.SWAGGER_SERVER_URL !== `http://localhost:${env.PORT}`
      ? [
          {
            url: `http://localhost:${env.PORT}`,
            description: "Local Development Server",
          },
        ]
      : []),
  ],
  tags: [
    {
      name: "Authentication",
      description: "User registration, login, token rotation, and multi-device session management.",
    },
    {
      name: "Projects",
      description: "Project workspace management, RBAC member invitations/evictions, archiving, and audit timeline.",
    },
    {
      name: "Tasks",
      description: "Sprint task items, status workflows, Kanban filtering, bulk operations, and event history.",
    },
    {
      name: "Notifications",
      description: "In-app website inbox notifications, unread counts, seen/unseen state management, and SendGrid email notifications.",
    },
    {
      name: "Health",
      description: "Health checks and operational status monitoring.",
    },
  ],
  components: {
    securitySchemes,
    schemas: {
      ...commonSchemas,
      ...authSchemas,
      ...projectSchemas,
      ...taskSchemas,
      ...notificationSchemas,
    },
    responses: {
      ...commonResponses,
    },
  },
  paths: {
    ...apiPaths,
  },
};
