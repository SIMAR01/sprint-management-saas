import Redis, { RedisOptions } from "ioredis";
import { env } from "./env";

/**
 * Base connection options extracted from environment configuration.
 */
const getBaseRedisOptions = (): RedisOptions => {
  const options: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB || 0,
    lazyConnect: true,
    enableAutoPipelining: true,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      console.warn(`[Redis] Reconnecting attempt #${times} in ${delay}ms...`);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  };

  return options;
};

/**
 * 1. Dedicated ioredis client for application-level Cache-Aside and Key-Value queries.
 */
export const cacheRedisClient = new Redis(getBaseRedisOptions());

cacheRedisClient.on("connect", () => {
  console.log("[Redis Cache] Connection established successfully.");
});

cacheRedisClient.on("ready", () => {
  console.log("[Redis Cache] Client is ready for queries.");
});

cacheRedisClient.on("error", (err) => {
  console.error("[Redis Cache] Error encountered:", err.message);
});

import { ConnectionOptions } from "bullmq";

/**
 * 2. Dedicated connection options for BullMQ Producers (Queues).
 */
export const bullMqProducerConnection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB || 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * 3. Dedicated connection options for BullMQ Workers.
 * Workers require maxRetriesPerRequest: null per BullMQ architectural specification.
 */
export const bullMqWorkerConnection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB || 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Connects the primary cache Redis instance.
 */
export const connectRedisConfig = async (): Promise<void> => {
  try {
    if (cacheRedisClient.status === "wait" || cacheRedisClient.status === "close") {
      await cacheRedisClient.connect();
      console.log("[Redis] Connected via ioredis client.");
    }
  } catch (error: any) {
    console.error("[Redis] Failed to connect to Redis server:", error.message);
    throw error;
  }
};

/**
 * Gracefully disconnects all Redis connections.
 */
export const closeRedisConnections = async (): Promise<void> => {
  try {
    if (cacheRedisClient.status !== "end") {
      await cacheRedisClient.quit();
      console.log("[Redis Cache] Connection gracefully closed.");
    }
  } catch (error: any) {
    console.warn("[Redis Cache] Error during shutdown:", error.message);
  }
};
