import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } from "./constants";
import { ApiError } from "./ApiError";
import { env } from "../config/env";

const JWT_SECRET = env.JWT_SECRET;

export interface UserTokenPayload {
  id: string;
  email: string;
  username: string;
}

export interface RefreshTokenPayload {
  id: string;
  sessionId: string;
}

/**
 * Generates an Access Token.
 * Expiry: 15 minutes.
 */
export const generateAccessToken = (payload: UserTokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY as any,
  });
};

/**
 * Generates a Refresh Token.
 * Expiry: 7 days.
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY as any,
  });
};

/**
 * Verifies an Access Token.
 * Throws ApiError if token is invalid or expired.
 */
export const verifyAccessToken = (token: string): UserTokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token has expired");
    }
    throw new ApiError(401, "Invalid access token");
  }
};

/**
 * Verifies a Refresh Token.
 * Throws ApiError if token is invalid or expired.
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Refresh token has expired");
    }
    throw new ApiError(401, "Invalid refresh token");
  }
};
