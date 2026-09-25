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
 * Client-side script injected into Swagger UI to automatically synchronize JWT Access Tokens:
 * 1. Automatically sets Bearer token in Swagger UI upon successful POST /auth/login.
 * 2. Automatically updates Bearer token in Swagger UI upon successful POST /auth/refresh-token.
 * 3. Automatically logs out and clears the Bearer token from Swagger UI and localStorage upon POST /auth/logout.
 */
const customJsStr = `
(function() {
  function getSwaggerUi() {
    return window.ui;
  }

  function autoAuthorize(token) {
    var ui = getSwaggerUi();
    if (!ui || !token) return;
    try {
      ui.authActions.authorize({
        BearerAuth: {
          name: "BearerAuth",
          schema: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          },
          value: token
        }
      });
      console.log("%c[Swagger UI Auth]%c Successfully synchronized Bearer JWT token in Swagger Docs!", "color: #16a34a; font-weight: bold;", "color: inherit;");
    } catch (e) {
      console.error("[Swagger UI Auth] Failed to auto-authorize Bearer token:", e);
    }
  }

  function autoLogout() {
    var ui = getSwaggerUi();
    if (!ui) return;
    try {
      ui.authActions.logout(['BearerAuth']);
      console.log("%c[Swagger UI Auth]%c Successfully logged out and cleared Bearer token from Swagger Docs!", "color: #dc2626; font-weight: bold;", "color: inherit;");
    } catch (e) {
      console.error("[Swagger UI Auth] Failed to clear Bearer token:", e);
    }
    try {
      localStorage.removeItem('authorized');
    } catch (e) {}
  }

  // 1. Monkey-patch window.fetch for Swagger UI network calls
  if (window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function() {
      var args = arguments;
      var url = args[0] ? (typeof args[0] === 'string' ? args[0] : args[0].url) : '';
      return originalFetch.apply(this, args).then(function(response) {
        if (response && response.status >= 200 && response.status < 300) {
          var urlStr = String(url);
          if (urlStr.includes('/auth/login') || urlStr.includes('/auth/refresh-token')) {
            response.clone().json().then(function(json) {
              var token = json && json.data && json.data.accessToken;
              if (token) {
                autoAuthorize(token);
              }
            }).catch(function() {});
          } else if (urlStr.includes('/auth/logout')) {
            autoLogout();
          }
        }
        return response;
      });
    };
  }

  // 2. Monkey-patch XMLHttpRequest for fallback
  var originalXhrOpen = XMLHttpRequest.prototype.open;
  var originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalXhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      if (this.status >= 200 && this.status < 300 && this._url) {
        var urlStr = String(this._url);
        if (urlStr.includes('/auth/login') || urlStr.includes('/auth/refresh-token')) {
          try {
            var json = JSON.parse(this.responseText);
            var token = json && json.data && json.data.accessToken;
            if (token) {
              autoAuthorize(token);
            }
          } catch (e) {}
        } else if (urlStr.includes('/auth/logout')) {
          autoLogout();
        }
      }
    });
    return originalXhrSend.apply(this, arguments);
  };
})();
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

  // 2. Serve the Swagger Auth Synchronization JavaScript helper file
  const customJsEndpoint = `${env.SWAGGER_ROUTE}/swagger-auth-sync.js`;
  app.get(customJsEndpoint, (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(customJsStr);
  });

  // 3. Swagger UI configuration options
  const uiOptions: swaggerUi.SwaggerUiOptions = {
    customSiteTitle: `${env.API_TITLE} - Interactive API Docs`,
    customCss,
    customJs: customJsEndpoint,
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

  // Provide customJsStr directly for inline injection into the rendered HTML
  (uiOptions as any).customJsStr = customJsStr;

  // 4. Mount Swagger UI middleware
  app.use(env.SWAGGER_ROUTE, swaggerUi.serve, swaggerUi.setup(swaggerSpec, uiOptions));

  // 5. Also provide a convenience redirect from /docs to the configured SWAGGER_ROUTE if different
  if (env.SWAGGER_ROUTE !== "/docs") {
    app.get("/docs", (_req: Request, res: Response) => {
      res.redirect(env.SWAGGER_ROUTE);
    });
  }

  console.log(`📑 Swagger Documentation initialized at ${env.SWAGGER_SERVER_URL}${env.SWAGGER_ROUTE}`);
  console.log(`📄 OpenAPI JSON Specification available at ${env.SWAGGER_SERVER_URL}${jsonEndpoint}`);
};
