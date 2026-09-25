import { CookieOptions } from "express";
import { env } from "../config/env";

/**
 * Cookie options for setting HTTP-only refresh tokens.
 * Secure flag is active only in production to allow local testing over HTTP.
 */
export const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "strict",
};

/**
 * Cookie name used to store the Refresh Token.
 */
export const REFRESH_TOKEN_COOKIE_NAME = env.REFRESH_TOKEN_COOKIE_NAME;

/**
 * Expiration times for JWTs.
 */
export const ACCESS_TOKEN_EXPIRY = env.ACCESS_TOKEN_EXPIRY;
export const REFRESH_TOKEN_EXPIRY = env.REFRESH_TOKEN_EXPIRY;
export const REFRESH_TOKEN_EXPIRY_MS = env.REFRESH_TOKEN_EXPIRY_MS;
