import express from "express";
import cors from "cors";
import router from "./routes/index";
import { errorHandler } from "./middleware/error.middleware";
import { ApiError } from "./utils/ApiError";
import { authRateLimiter } from "./middleware/rateLimit.middleware";
import { env } from "./config/env";
import { setupSwagger } from "./config/swagger";

const app = express();

// Global Middlewares
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
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