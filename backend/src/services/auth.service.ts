import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/user.model";
import { comparePassword, hashPassword } from "../utils/password";
import { ApiError } from "../utils/ApiError";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { redisClient } from "../config/redis";
import { parseUserAgent } from "../utils/userAgent";
import { addAuditJob } from "../queues/audit.queue";
import { addEmailJob } from "../queues/email.queue";
import { getWelcomeEmail } from "../utils/emailTemplates";

export class AuthService {
  /**
   * Registers a new user.
   */
  public static async registerUser(
    userData: Partial<IUser>,
    context?: { ip?: string; userAgent?: string; correlationId?: string }
  ): Promise<Omit<IUser, "password" | "refreshTokens">> {
    const { name, username, email, password } = userData;
    if (!name || !username || !email || !password) {
      throw new ApiError(400, "All fields are required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      throw new ApiError(409, "User with this email or username already exists");
    }

    const user = new User({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password,
    });

    await user.save();

    // 1. Asynchronously enqueue Welcome Email via BullMQ
    try {
      const welcomeTemplate = getWelcomeEmail({
        userName: user.name,
        userEmail: user.email,
      });
      await addEmailJob({
        to: user.email,
        subject: welcomeTemplate.subject,
        html: welcomeTemplate.html,
        text: welcomeTemplate.text,
        correlationId: context?.correlationId,
      });
    } catch (err: any) {
      console.warn("[AuthService] Non-blocking: Failed to enqueue welcome email:", err.message);
    }

    // 2. Asynchronously enqueue Audit Log
    await addAuditJob({
      action: "USER_REGISTERED",
      actor: {
        userId: user.uuid.id,
        email: user.email,
        role: "User",
      },
      resource: {
        type: "USER",
        id: user.uuid.id,
        name: user.name,
      },
      context: {
        ip: context?.ip || "unknown",
        userAgent: context?.userAgent || "unknown",
        correlationId: context?.correlationId,
      },
      metadata: {
        username: user.username,
        email: user.email,
      },
    });

    const userJson = user.toObject();
    delete (userJson as any).password;
    delete (userJson as any).refreshTokens;

    return userJson;
  }

  /**
   * Log in user, generating tokens and caching the active session in Redis.
   */
  public static async loginUser(
    emailOrUsername: string,
    password: string,
    ip = "unknown",
    userAgent = "unknown",
    correlationId?: string
  ): Promise<{
    user: { id: string; name: string; username: string; email: string };
    accessToken: string;
    plainRefreshToken: string;
  }> {
    const queryTerm = emailOrUsername.toLowerCase().trim();

    const user = await User.findOne({
      $or: [{ email: queryTerm }, { username: queryTerm }],
    }).select("+password +refreshTokens");

    if (!user) {
      throw new ApiError(401, "Invalid email/username or password");
    }

    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      throw new ApiError(401, "Invalid email/username or password");
    }

    const userId = user.uuid.id;
    const sessionId = crypto.randomUUID();

    // Generate tokens
    const accessToken = generateAccessToken({
      id: userId,
      email: user.email,
      username: user.username,
      sessionId,
    });
    const plainRefreshToken = generateRefreshToken({ id: userId, sessionId });

    // Store active refresh token in Redis with metadata: key format is session:userId:sessionId (7 days TTL)
    const sessionKey = `session:${userId}:${sessionId}`;
    const parsedUA = parseUserAgent(userAgent);
    const sessionData = {
      sessionId,
      userId,
      ip,
      userAgent,
      browser: parsedUA.browser,
      os: parsedUA.os,
      device: parsedUA.device,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      refreshToken: plainRefreshToken,
      currentAccessToken: accessToken,
    };

    await redisClient.set(sessionKey, JSON.stringify(sessionData), "EX", 7 * 24 * 60 * 60);

    // Also persist hashed refresh token in MongoDB as fallback
    const hashed = await hashPassword(plainRefreshToken);
    if (!user.refreshTokens) {
      user.refreshTokens = [];
    }
    user.refreshTokens.push(hashed);

    // Limit active sessions to 10
    if (user.refreshTokens.length > 10) {
      user.refreshTokens.shift();
    }

    await user.save();

    // Enqueue audit log asynchronously
    await addAuditJob({
      action: "USER_LOGGED_IN",
      actor: {
        userId,
        email: user.email,
        role: "User",
      },
      resource: {
        type: "SESSION",
        id: sessionId,
      },
      context: {
        ip,
        userAgent,
        correlationId,
      },
      metadata: {
        browser: parsedUA.browser,
        os: parsedUA.os,
        device: parsedUA.device,
      },
    });

    return {
      user: {
        id: userId,
        name: user.name,
        username: user.username,
        email: user.email,
      },
      accessToken,
      plainRefreshToken,
    };
  }

  /**
   * Refreshes access and refresh tokens using Redis-cached sessions, with MongoDB fallback.
   * Automatically invalidates both the previous access token and the rotated refresh token in Redis.
   */
  public static async refreshUserTokens(
    plainRefreshToken: string,
    ip?: string,
    userAgent?: string,
    oldAccessToken?: string,
    correlationId?: string
  ): Promise<{
    accessToken: string;
    newPlainRefreshToken: string;
  }> {
    // 0. Check if this refresh token was previously revoked/blacklisted
    try {
      const isBlacklisted = await redisClient.get(`blacklist:refresh:${plainRefreshToken}`);
      if (isBlacklisted) {
        throw new ApiError(401, "Refresh token has been revoked. Please log in again.");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.error("Redis error checking refresh token blacklist:", err);
    }

    // 1. Verify token signature statelessly
    const decoded = verifyRefreshToken(plainRefreshToken);
    const userId = decoded.id;
    const sessionId = decoded.sessionId;

    // 2. Check session in Redis
    const sessionKey = `session:${userId}:${sessionId}`;
    let sessionData: any = null;
    const sessionExists = await redisClient.get(sessionKey);

    if (sessionExists) {
      try {
        sessionData = JSON.parse(sessionExists);
      } catch (err) {
        console.error("Failed to parse Redis session data:", err);
      }
    }

    // 3. Fallback: if not in Redis or token doesn't match, check MongoDB
    const user = await User.findOne({ "uuid.id": userId }).select("+refreshTokens");
    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    let tokenMatched = false;
    let oldHashedTokenMatched = "";

    if (sessionData && sessionData.refreshToken === plainRefreshToken) {
      tokenMatched = true;
    } else {
      // Redis missed or token didn't match: check DB fallback
      if (user.refreshTokens && user.refreshTokens.length > 0) {
        for (const hashedToken of user.refreshTokens) {
          if (await comparePassword(plainRefreshToken, hashedToken)) {
            tokenMatched = true;
            oldHashedTokenMatched = hashedToken;
            break;
          }
        }
      }
    }

    if (!tokenMatched) {
      // Security warning: possible token reuse, clear all sessions as precaution
      user.refreshTokens = [];
      await user.save();

      // Scan and delete all sessions from Redis
      const pattern = `session:${userId}:*`;
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");

      throw new ApiError(401, "Invalid or expired session / potential reuse detected");
    }

    // 4. Invalidate previous Access Token in Redis
    if (oldAccessToken) {
      try {
        const decodedOld = jwt.decode(oldAccessToken) as { exp?: number };
        if (decodedOld?.exp) {
          const rem = decodedOld.exp - Math.floor(Date.now() / 1000);
          if (rem > 0) {
            await redisClient.set(`blacklist:${oldAccessToken}`, "revoked", "EX", rem);
          }
        }
      } catch (err) {
        console.error("Failed to blacklist old access token during refresh:", err);
      }
    }

    // Blacklist currentAccessToken stored in existing Redis session data
    if (sessionData && sessionData.currentAccessToken) {
      try {
        const decodedPrev = jwt.decode(sessionData.currentAccessToken) as { exp?: number };
        if (decodedPrev?.exp) {
          const rem = decodedPrev.exp - Math.floor(Date.now() / 1000);
          if (rem > 0) {
            await redisClient.set(`blacklist:${sessionData.currentAccessToken}`, "revoked", "EX", rem);
          }
        }
      } catch (err) {
        console.error("Failed to blacklist previous session access token during refresh:", err);
      }
    }

    // 5. Blacklist the old rotating Refresh Token in Redis (7 days TTL)
    try {
      const decodedRefresh = jwt.decode(plainRefreshToken) as { exp?: number };
      const refreshRemaining = decodedRefresh?.exp
        ? decodedRefresh.exp - Math.floor(Date.now() / 1000)
        : 7 * 24 * 60 * 60;
      if (refreshRemaining > 0) {
        await redisClient.set(`blacklist:refresh:${plainRefreshToken}`, "rotated", "EX", refreshRemaining);
      }
    } catch (err) {
      console.error("Failed to blacklist rotated refresh token:", err);
    }

    // 6. Generate rotated tokens (maintaining the same sessionId)
    const accessToken = generateAccessToken({
      id: userId,
      email: user.email,
      username: user.username,
      sessionId,
    });
    const newPlainRefreshToken = generateRefreshToken({ id: userId, sessionId });

    // 7. Update/Save session in Redis with new accessToken and refreshToken
    const parsedUA = parseUserAgent(userAgent || (sessionData?.userAgent));
    const updatedSessionData = {
      sessionId,
      userId,
      ip: ip || (sessionData?.ip || "unknown"),
      userAgent: userAgent || (sessionData?.userAgent || "unknown"),
      browser: parsedUA.browser,
      os: parsedUA.os,
      device: parsedUA.device,
      lastActive: new Date().toISOString(),
      createdAt: sessionData?.createdAt || new Date().toISOString(),
      refreshToken: newPlainRefreshToken,
      currentAccessToken: accessToken,
    };

    await redisClient.set(sessionKey, JSON.stringify(updatedSessionData), "EX", 7 * 24 * 60 * 60);

    // 8. Update fallback DB token
    const newHashedToken = await hashPassword(newPlainRefreshToken);
    if (!user.refreshTokens) {
      user.refreshTokens = [];
    }

    if (oldHashedTokenMatched) {
      const idx = user.refreshTokens.indexOf(oldHashedTokenMatched);
      if (idx !== -1) {
        user.refreshTokens[idx] = newHashedToken;
      } else {
        user.refreshTokens.push(newHashedToken);
      }
    } else {
      let replaced = false;
      for (let i = 0; i < user.refreshTokens.length; i++) {
        if (await comparePassword(plainRefreshToken, user.refreshTokens[i])) {
          user.refreshTokens[i] = newHashedToken;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        user.refreshTokens.push(newHashedToken);
      }
    }

    if (user.refreshTokens.length > 10) {
      user.refreshTokens.shift();
    }

    await user.save();

    return {
      accessToken,
      newPlainRefreshToken,
    };
  }

  /**
   * Log out user, removing session key(s) from Redis and blacklisting both Access Token and Refresh Token.
   */
  public static async logoutUser(options: {
    userId: string;
    accessToken?: string;
    plainRefreshToken?: string;
    sessionIdToLogout?: string | null;
    logoutAll?: boolean;
    correlationId?: string;
  }): Promise<{
    loggedOutSessions: Array<{
      sessionId: string;
      ip: string;
      browser: string;
      os: string;
      device: string;
    }>;
  }> {
    const { userId, accessToken, plainRefreshToken, sessionIdToLogout, logoutAll, correlationId } = options;

    const user = await User.findOne({ "uuid.id": userId }).select("+refreshTokens");
    const loggedOutSessions: any[] = [];

    // 1. Blacklist current Access Token in Redis
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as { exp?: number };
        if (decoded && decoded.exp) {
          const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
          if (remainingSeconds > 0) {
            await redisClient.set(`blacklist:${accessToken}`, "logged_out", "EX", remainingSeconds);
          }
        }
      } catch (error) {
        console.error("Failed to store access token in Redis blacklist:", error);
      }
    }

    // 2. Blacklist provided Refresh Token in Redis
    if (plainRefreshToken) {
      try {
        const decoded = jwt.decode(plainRefreshToken) as { exp?: number };
        const remainingSeconds = decoded && decoded.exp
          ? decoded.exp - Math.floor(Date.now() / 1000)
          : 7 * 24 * 60 * 60;
        if (remainingSeconds > 0) {
          await redisClient.set(`blacklist:refresh:${plainRefreshToken}`, "logged_out", "EX", remainingSeconds);
        }
      } catch (error) {
        console.error("Failed to store refresh token in Redis blacklist:", error);
      }
    }

    // 3. Handle Session Revocation
    if (logoutAll) {
      try {
        await redisClient.set(
          `user:revoked_before:${userId}`,
          Math.floor(Date.now() / 1000).toString(),
          "EX",
          15 * 60
        );
      } catch (err) {
        console.error("Failed to set global revocation timestamp:", err);
      }

      const pattern = `session:${userId}:*`;
      let cursor = "0";
      const keysToDelete: string[] = [];
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          keysToDelete.push(...keys);
        }
      } while (cursor !== "0");

      if (keysToDelete.length > 0) {
        const values = await redisClient.mget(...keysToDelete);
        for (const val of values) {
          if (val) {
            try {
              const session = JSON.parse(val);
              const { refreshToken: rToken, currentAccessToken: cAccess, ...publicSession } = session;
              loggedOutSessions.push(publicSession);

              if (rToken) {
                await redisClient.set(`blacklist:refresh:${rToken}`, "logged_out", "EX", 7 * 24 * 60 * 60);
              }
              if (cAccess) {
                const dec = jwt.decode(cAccess) as { exp?: number };
                if (dec?.exp) {
                  const rem = dec.exp - Math.floor(Date.now() / 1000);
                  if (rem > 0) {
                    await redisClient.set(`blacklist:${cAccess}`, "logged_out", "EX", rem);
                  }
                }
              }
            } catch (err) {
              console.error("Error parsing session data during logout-all:", err);
            }
          }
        }
        await redisClient.del(...keysToDelete);
      }

      if (user) {
        user.refreshTokens = [];
        await user.save();
      }
    } else if (sessionIdToLogout !== undefined && sessionIdToLogout !== null) {
      const sessionKey = `session:${userId}:${sessionIdToLogout}`;
      const sessionDataStr = await redisClient.get(sessionKey);

      if (!sessionDataStr) {
        throw new ApiError(400, "Session ID is not valid for this user");
      }

      await redisClient.del(sessionKey);

      try {
        const sessionData = JSON.parse(sessionDataStr);
        const { refreshToken: tokenToRevoke, currentAccessToken: cAccess, ...publicSession } = sessionData;
        loggedOutSessions.push(publicSession);

        if (tokenToRevoke) {
          await redisClient.set(`blacklist:refresh:${tokenToRevoke}`, "logged_out", "EX", 7 * 24 * 60 * 60);
        }
        if (cAccess) {
          const dec = jwt.decode(cAccess) as { exp?: number };
          if (dec?.exp) {
            const rem = dec.exp - Math.floor(Date.now() / 1000);
            if (rem > 0) {
              await redisClient.set(`blacklist:${cAccess}`, "logged_out", "EX", rem);
            }
          }
        }

        if (user && user.refreshTokens && tokenToRevoke) {
          const filteredTokens: string[] = [];
          for (const hashedToken of user.refreshTokens) {
            if (!(await comparePassword(tokenToRevoke, hashedToken))) {
              filteredTokens.push(hashedToken);
            }
          }
          user.refreshTokens = filteredTokens;
          await user.save();
        }
      } catch (err) {
        console.error("Error parsing session data during specific logout:", err);
      }
    } else {
      let targetSessionId: string | undefined;

      if (plainRefreshToken) {
        try {
          const decoded = verifyRefreshToken(plainRefreshToken);
          targetSessionId = decoded.sessionId;
        } catch (err) {}
      }

      if (!targetSessionId && accessToken) {
        try {
          const decodedAccess = jwt.decode(accessToken) as { sessionId?: string };
          targetSessionId = decodedAccess?.sessionId;
        } catch (err) {}
      }

      if (targetSessionId) {
        const sessionKey = `session:${userId}:${targetSessionId}`;
        const sessionDataStr = await redisClient.get(sessionKey);
        await redisClient.del(sessionKey);

        if (sessionDataStr) {
          try {
            const sessionData = JSON.parse(sessionDataStr);
            const { refreshToken: tokenToRevoke, currentAccessToken: cAccess, ...publicSession } = sessionData;
            loggedOutSessions.push(publicSession);

            if (tokenToRevoke) {
              await redisClient.set(`blacklist:refresh:${tokenToRevoke}`, "logged_out", "EX", 7 * 24 * 60 * 60);
              if (user && user.refreshTokens) {
                const filteredTokens: string[] = [];
                for (const hashedToken of user.refreshTokens) {
                  if (!(await comparePassword(tokenToRevoke, hashedToken))) {
                    filteredTokens.push(hashedToken);
                  }
                }
                user.refreshTokens = filteredTokens;
                await user.save();
              }
            }

            if (cAccess && cAccess !== accessToken) {
              const dec = jwt.decode(cAccess) as { exp?: number };
              if (dec?.exp) {
                const rem = dec.exp - Math.floor(Date.now() / 1000);
                if (rem > 0) {
                  await redisClient.set(`blacklist:${cAccess}`, "logged_out", "EX", rem);
                }
              }
            }
          } catch (err) {
            console.error("Error parsing session data during current logout:", err);
          }
        }
      } else if (plainRefreshToken && user && user.refreshTokens) {
        const filteredTokens: string[] = [];
        for (const hashedToken of user.refreshTokens) {
          if (!(await comparePassword(plainRefreshToken, hashedToken))) {
            filteredTokens.push(hashedToken);
          }
        }
        user.refreshTokens = filteredTokens;
        await user.save();
      }
    }

    // Enqueue audit log asynchronously
    await addAuditJob({
      action: logoutAll ? "USER_LOGGED_OUT_ALL" : "USER_LOGGED_OUT",
      actor: {
        userId,
        email: user?.email || "unknown@teamflow.app",
        role: "User",
      },
      resource: {
        type: "SESSION",
        id: sessionIdToLogout || "current",
      },
      context: {
        correlationId,
      },
      metadata: {
        logoutAll: !!logoutAll,
        sessionsRevokedCount: loggedOutSessions.length,
      },
    });

    return {
      loggedOutSessions,
    };
  }

  public static async getCurrentUser(userId: string): Promise<Omit<IUser, "password" | "refreshTokens">> {
    const user = await User.findOne({ "uuid.id": userId });
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    return user.toObject();
  }

  /**
   * Retrieves all active sessions for the user from Redis.
   */
  public static async getActiveSessions(
    userId: string,
    currentSessionId?: string
  ): Promise<any[]> {
    const pattern = `session:${userId}:*`;
    const sessions: any[] = [];
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const values = await redisClient.mget(...keys);
        for (let i = 0; i < keys.length; i++) {
          const value = values[i];
          if (value) {
            try {
              const session = JSON.parse(value);
              const { refreshToken, ...publicSession } = session;
              sessions.push({
                ...publicSession,
                isCurrent: session.sessionId === currentSessionId,
              });
            } catch (err) {
              console.error("Failed to parse session data from Redis:", err);
            }
          }
        }
      }
    } while (cursor !== "0");

    return sessions.sort(
      (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );
  }
}
