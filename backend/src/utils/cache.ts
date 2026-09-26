import { cacheRedisClient } from "../config/redis.config";

/**
 * Production-Grade Cache-Aside Utility using Redis.
 */
export class CacheUtil {
  /**
   * Retrieves a parsed JSON value from Redis.
   */
  public static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await cacheRedisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err: any) {
      console.warn(`[Cache] Error reading key "${key}":`, err.message);
      return null;
    }
  }

  /**
   * Stores a value in Redis with a TTL in seconds.
   */
  public static async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await cacheRedisClient.set(key, serialized, "EX", ttlSeconds);
    } catch (err: any) {
      console.warn(`[Cache] Error setting key "${key}":`, err.message);
    }
  }

  /**
   * Deletes one or more specific keys from Redis.
   */
  public static async del(keys: string | string[]): Promise<void> {
    try {
      const targetKeys = Array.isArray(keys) ? keys : [keys];
      if (targetKeys.length > 0) {
        await cacheRedisClient.del(...targetKeys);
      }
    } catch (err: any) {
      console.warn("[Cache] Error deleting keys:", err.message);
    }
  }

  /**
   * Deletes all keys matching a given glob pattern (e.g., "project:123:*").
   */
  public static async deleteByPattern(pattern: string): Promise<void> {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await cacheRedisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await cacheRedisClient.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err: any) {
      console.warn(`[Cache] Error deleting keys matching pattern "${pattern}":`, err.message);
    }
  }

  /**
   * Invalidate all cached data related to a project workspace (tasks, details, timeline).
   */
  public static async invalidateProjectCache(projectId: string): Promise<void> {
    await Promise.all([
      CacheUtil.deleteByPattern(`project:${projectId}:*`),
      CacheUtil.deleteByPattern(`cache:project:${projectId}:*`),
      CacheUtil.del(`project:${projectId}:details`),
      CacheUtil.del(`project:${projectId}:members`),
    ]);
  }

  /**
   * Invalidate task specific cache listings.
   */
  public static async invalidateTaskCache(projectId: string): Promise<void> {
    await CacheUtil.deleteByPattern(`cache:project:${projectId}:tasks:*`);
  }
}
