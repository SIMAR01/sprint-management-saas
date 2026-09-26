import { cacheRedisClient, connectRedisConfig } from "./redis.config";

/**
 * Re-export cache client and connection function for backward compatibility.
 */
export const redisClient = cacheRedisClient;
export const connectRedis = connectRedisConfig;
export default redisClient;