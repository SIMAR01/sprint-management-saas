import { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";
import { swaggerDefinition } from "../docs/swagger.definition";

/**
 * Compiles the OpenAPI specification via swagger-jsdoc.
 * Assembles all modular typed components instantaneously without slow glob disk I/O.
 */
const swaggerOptions: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: [], // All endpoints are cleanly modularized in src/docs/routes/
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Custom modern CSS for an elevated, clean, production-grade Swagger UI experience.
 */
const customCss = `
  /* Modern clean font and typography */
  body, .swagger-ui {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .swagger-ui .topbar {
    display: none;
  }
  .swagger-ui .info {
    margin: 25px 0 20px 0;
  }
  .swagger-ui .info .title {
    font-size: 32px;
    font-weight: 700;
    color: #111827;
  }
  .swagger-ui .info p, .swagger-ui .info li {
    font-size: 14.5px;
    line-height: 1.6;
    color: #374151;
  }
  .swagger-ui .info a {
    color: #2563eb;
    text-decoration: underline;
  }
  .swagger-ui .opblock.opblock-post {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.05);
  }
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #16a34a;
  }
  .swagger-ui .opblock.opblock-get {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #2563eb;
  }
  .swagger-ui .btn.authorize {
    background-color: #16a34a;
    border-color: #16a34a;
    color: #ffffff;
  }
  .swagger-ui .btn.authorize svg {
    fill: #ffffff;
  }
  .swagger-ui .opblock-tag {
    font-size: 18px;
    border-bottom: 2px solid #e5e7eb;
    padding: 10px 0;
  }
`;

/**
 * Configures and mounts Swagger UI and the OpenAPI JSON endpoint onto the Express application.
 *
 * @param app Express application instance
 */
export const setupSwagger = (app: Express): void => {
  if (!env.SWAGGER_ENABLED) {
    console.log("ℹ️ Swagger documentation is disabled by configuration (SWAGGER_ENABLED=false)");
    return;
  }

  // 1. Expose raw OpenAPI JSON spec endpoint for client codegen, Postman, and CI/CD tools
  const jsonEndpoint = `${env.SWAGGER_ROUTE}.json`;
  app.get(jsonEndpoint, (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // 2. Swagger UI configuration options
  const uiOptions: swaggerUi.SwaggerUiOptions = {
    customSiteTitle: `${env.API_TITLE} - Interactive API Docs`,
    customCss,
    swaggerOptions: {
      persistAuthorization: true,      // Persists JWT Bearer token across page refreshes
      displayRequestDuration: true,    // Displays execution response time in milliseconds
      filter: true,                    // Enables instantaneous search/filter bar for endpoints
      tryItOutEnabled: true,           // Automatically expands the "Try it out" button
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      docExpansion: "list",            // Expands tags by default for intuitive browsing
    },
  };

  // 3. Mount Swagger UI middleware
  app.use(env.SWAGGER_ROUTE, swaggerUi.serve, swaggerUi.setup(swaggerSpec, uiOptions));

  // 4. Also provide a convenience redirect from /docs to the configured SWAGGER_ROUTE if different
  if (env.SWAGGER_ROUTE !== "/docs") {
    app.get("/docs", (_req: Request, res: Response) => {
      res.redirect(env.SWAGGER_ROUTE);
    });
  }

  console.log(`📑 Swagger Documentation initialized at ${env.SWAGGER_SERVER_URL}${env.SWAGGER_ROUTE}`);
  console.log(`📄 OpenAPI JSON Specification available at ${env.SWAGGER_SERVER_URL}${jsonEndpoint}`);
};
