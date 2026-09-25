import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";
import { User } from "../models/user.model";
import { redisClient } from "../config/redis";

/**
 * Authentication middleware to protect private endpoints.
 * Validates JWT access token, verifies Redis blacklist, checks global revocation timestamp,
 * and confirms that the backing user session is active.
 */
export const protect = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    let token: string | undefined;

    // 1. Extract Bearer Token from Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      throw new ApiError(401, "Not authorized, token missing");
    }

    // 2. Check if token is blacklisted in Redis (e.g. user logged out or token refreshed)
    let isBlacklisted = false;
    try {
      const result = await redisClient.get(`blacklist:${token}`);
      if (result) {
        isBlacklisted = true;
      }
    } catch (redisError) {
      console.error("Redis connection error during blacklist check:", redisError);
    }

    if (isBlacklisted) {
      throw new ApiError(401, "Token has been revoked or invalidated. Please log in again.");
    }

    // 3. Verify JWT signature and token expiration
    const decoded = verifyAccessToken(token);

    // 4. Check global device revocation timestamp in Redis
    try {
      const revokedBefore = await redisClient.get(`user:revoked_before:${decoded.id}`);
      if (revokedBefore && decoded.iat && decoded.iat <= Number(revokedBefore)) {
        throw new ApiError(401, "Session has been terminated across all devices. Please log in again.");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.error("Redis connection error during user revocation check:", err);
    }

    // 5. If access token contains a sessionId, verify that the session is still active in Redis
    if (decoded.sessionId) {
      try {
        const sessionExists = await redisClient.get(`session:${decoded.id}:${decoded.sessionId}`);
        if (!sessionExists) {
          throw new ApiError(401, "Session has expired or was terminated. Please log in again.");
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
        console.error("Redis connection error during session verification:", err);
      }
    }

    // 6. Retrieve current user from database by uuid
    const user = await User.findOne({ "uuid.id": decoded.id });
    if (!user) {
      throw new ApiError(401, "User not found or account deactivated");
    }

    // 7. Attach user profile and token to request context
    req.user = user.toObject();
    req.token = token;

    next();
  }
);

