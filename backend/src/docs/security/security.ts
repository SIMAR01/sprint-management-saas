/**
 * OpenAPI 3.0 Security Schemes Definitions
 * Supports both HTTP Bearer JWT Authentication and HTTP-Only Cookie Refresh Tokens.
 */
export const securitySchemes = {
  BearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Enter your JWT Access Token. In the Swagger UI Authorize modal, you can paste your raw JWT or `Bearer <JWT>`. Required for all private/protected endpoints.",
  },
  CookieAuth: {
    type: "apiKey",
    in: "cookie",
    name: "refreshToken",
    description:
      "HTTP-Only secure cookie named `refreshToken` with 7 days lifetime. Used for stateless token rotation via `/api/v1/auth/refresh-token` and session termination via `/api/v1/auth/logout`.",
  },
};
