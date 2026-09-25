/**
 * OpenAPI 3.0 Path Definition for Health Check Endpoint
 */
export const healthDocs = {
  "/health": {
    get: {
      tags: ["Health"],
      summary: "System health check",
      description: "Returns the health and operational status of the backend API service.",
      operationId: "getHealthStatus",
      security: [],
      responses: {
        200: {
          description: "Service is healthy and operating normally",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/HealthCheckResponse",
              },
              example: {
                success: true,
                message: "Server is healthy",
              },
            },
          },
        },
        500: {
          $ref: "#/components/responses/InternalServerError",
        },
      },
    },
  },
};
