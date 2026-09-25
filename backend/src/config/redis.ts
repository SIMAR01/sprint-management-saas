import { createClient } from "redis";
import { env } from "./env";

export let redisClient = createClient({
  url: env.REDIS_URL,
});

const attachListeners = (client: typeof redisClient) => {
  client.on("connect", () => {
    console.log("Connecting to Redis...");
  });

  client.on("ready", () => {
    console.log("Redis is ready");
  });

  client.on("error", (error) => {
    console.error("Redis Error:", error.message);
  });

  client.on("reconnecting", () => {
    console.log("Reconnecting to Redis...");
  });

  client.on("end", () => {
    console.log("Redis connection closed");
  });
};

attachListeners(redisClient);

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 2000;

/**
 * Connects to Redis with automatic retry logic and Docker/local fallback support.
 */
export const connectRedis = async (): Promise<void> => {
  let attempt = 0;
  let targetUrl = env.REDIS_URL;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      console.log(`Connecting to Redis (Attempt ${attempt}/${MAX_RETRIES})...`);
      await redisClient.connect();
      console.log("Redis Connected");
      return;
    } catch (error: any) {
      console.error(
        `Redis connection attempt ${attempt}/${MAX_RETRIES} failed:`,
        error?.message || error
      );

      // If running with localhost/127.0.0.1 failed, try Docker 'redis' service hostname as fallback
      if (
        (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1")) &&
        attempt === 2
      ) {
        targetUrl = targetUrl.replace(/localhost|127\.0\.0\.1/, "redis");
        console.log(`Attempting fallback to Docker Redis service URL: ${targetUrl}`);
        try {
          redisClient = createClient({ url: targetUrl });
          attachListeners(redisClient);
          await redisClient.connect();
          console.log("Redis Connected via fallback");
          return;
        } catch (fallbackError: any) {
          console.error("Fallback Redis connection failed:", fallbackError?.message || fallbackError);
        }
      }

      if (attempt >= MAX_RETRIES) {
        console.error("CRITICAL: All Redis connection attempts failed.");
        process.exit(1);
      }

      console.log(`Retrying Redis connection in ${RETRY_INTERVAL_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
};