import express from "express";
import cors from "cors";
import router from "./routes/index";
import { errorHandler } from "./middleware/error.middleware";
import { ApiError } from "./utils/ApiError";
import { correlationMiddleware } from "./middleware/correlation.middleware";
import { authRateLimiter } from "./middleware/rateLimit.middleware";
import { env } from "./config/env";
import { setupSwagger } from "./config/swagger";

const app = express();

// Correlation ID Tracking Middleware (Runs on all incoming requests)
app.use(correlationMiddleware);

// Global Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Swagger UI) or trusted origins
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        ...(env.CORS_ORIGIN ? [env.CORS_ORIGIN] : []),
      ];
      if (allowedOrigins.includes(origin) || !env.isProduction) {
        return callback(null, true);
      }
      return callback(new ApiError(403, "Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-idempotency-key", "x-correlation-id"],
    exposedHeaders: ["x-correlation-id"],
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Initialize Production-Grade Swagger / OpenAPI UI Documentation
setupSwagger(app);

// Health Check Endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

// Protect all Authentication endpoints with our custom Redis rate limiter
app.use("/api/v1/auth", authRateLimiter);

// Versioned API Routes
app.use("/api/v1", router);

// Wildcard Catch-All Route for Unhandled Endpoints
app.use((req, _res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;