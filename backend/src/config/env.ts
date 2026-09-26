import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Ensure environment variables are loaded
dotenv.config();

/**
 * Validates and provides strongly-typed application environment configuration.
 * Prevents static configuration values from being scattered across the codebase.
 */
export interface EnvironmentConfig {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  CORS_ORIGIN: string;
  MONGODB_URI: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY_MS: number;
  REFRESH_TOKEN_COOKIE_NAME: string;
  SWAGGER_ENABLED: boolean;
  SWAGGER_ROUTE: string;
  SWAGGER_SERVER_URL: string;
  API_TITLE: string;
  API_VERSION: string;
  API_DESCRIPTION: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_FOLDER: string;
  SENDGRID_API_KEY: string;
  SENDGRID_FROM_EMAIL: string;
  SENDGRID_FROM_NAME: string;
  APP_URL: string;
  ADMIN_EMAILS: string[];
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  isDocker: boolean;
  isSendGridConfigured: boolean;
}

const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase() as "development" | "production" | "test";
const port = parseInt(process.env.PORT || "5000", 10);
const isProd = nodeEnv === "production";
const isDev = nodeEnv === "development";
const isTest = nodeEnv === "test";

// Detect if running inside a Docker container
const isDocker = fs.existsSync("/.dockerenv") || process.env.IS_DOCKER === "true";

// Determine database and cache hostnames based on runtime environment
const defaultMongoHost = isDocker ? "mongodb" : "127.0.0.1";
const defaultRedisHost = isDocker ? "redis" : "127.0.0.1";

let mongoUri = process.env.MONGODB_URI || `mongodb://${defaultMongoHost}:27017/sprint-management`;
let redisUrl = process.env.REDIS_URL || `redis://${defaultRedisHost}:6379`;

// If running inside Docker, automatically translate localhost/127.0.0.1 to Docker container service names
if (isDocker) {
  if (mongoUri.includes("localhost") || mongoUri.includes("127.0.0.1")) {
    mongoUri = mongoUri.replace(/localhost|127\.0\.0\.1/, "mongodb");
  }
  if (redisUrl.includes("localhost") || redisUrl.includes("127.0.0.1")) {
    redisUrl = redisUrl.replace(/localhost|127\.0\.0\.1/, "redis");
  }
}

// Enforce JWT secret check with proper error handling
const jwtSecret = process.env.JWT_SECRET || (isProd ? "" : "development_jwt_secret_teamflow_super_key_2026");
if (isProd && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error("FATAL: JWT_SECRET environment variable must be set and at least 32 characters in production!");
}

const swaggerServerUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${port}`;
const swaggerRoute = process.env.SWAGGER_ROUTE || "/api/docs";
const swaggerEnabled = process.env.SWAGGER_ENABLED !== undefined 
  ? process.env.SWAGGER_ENABLED === "true" 
  : true;

const sendGridApiKey = process.env.SENDGRID_API_KEY || "";
const adminEmailsRaw = process.env.ADMIN_EMAILS || "";
const adminEmails = adminEmailsRaw
  ? adminEmailsRaw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  : ["admin@teamflow.app"];

export const env: EnvironmentConfig = {
  NODE_ENV: nodeEnv,
  PORT: isNaN(port) ? 5000 : port,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  MONGODB_URI: mongoUri,
  REDIS_URL: redisUrl,
  JWT_SECRET: jwtSecret,
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  REFRESH_TOKEN_COOKIE_NAME: process.env.REFRESH_TOKEN_COOKIE_NAME || "refreshToken",
  SWAGGER_ENABLED: swaggerEnabled,
  SWAGGER_ROUTE: swaggerRoute.startsWith("/") ? swaggerRoute : `/${swaggerRoute}`,
  SWAGGER_SERVER_URL: swaggerServerUrl,
  API_TITLE: process.env.API_TITLE || "TeamFlow API",
  API_VERSION: process.env.API_VERSION || "1.0.0",
  API_DESCRIPTION: process.env.API_DESCRIPTION || "Production-grade Sprint & Project Management SaaS API Documentation",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || "teamflow/tasks",
  SENDGRID_API_KEY: sendGridApiKey,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "notifications@teamflow.app",
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || "TeamFlow Notifications",
  APP_URL: process.env.APP_URL || "http://localhost:5173",
  ADMIN_EMAILS: adminEmails,
  isProduction: isProd,
  isDevelopment: isDev,
  isTest: isTest,
  isDocker: isDocker,
  isSendGridConfigured: Boolean(sendGridApiKey && sendGridApiKey.startsWith("SG.")),
};
