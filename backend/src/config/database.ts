import mongoose from "mongoose";
import { env } from "./env";

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 2000;

/**
 * Connects to MongoDB with automatic retry logic and Docker/local fallback support.
 */
export const connectDB = async (): Promise<void> => {
  let attempt = 0;
  let targetUri = env.MONGODB_URI;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      console.log(`Connecting to MongoDB (Attempt ${attempt}/${MAX_RETRIES})...`);
      const connection = await mongoose.connect(targetUri, {
        serverSelectionTimeoutMS: 5000,
      });

      console.log(`MongoDB Connected: ${connection.connection.host}`);
      return;
    } catch (error: any) {
      console.error(
        `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`,
        error?.message || error
      );

      // If running with localhost/127.0.0.1 failed, try Docker 'mongodb' service hostname as fallback
      if (
        (targetUri.includes("localhost") || targetUri.includes("127.0.0.1")) &&
        attempt === 2
      ) {
        targetUri = targetUri.replace(/localhost|127\.0\.0\.1/, "mongodb");
        console.log(`Attempting fallback to Docker service URI: ${targetUri}`);
      }

      if (attempt >= MAX_RETRIES) {
        console.error("CRITICAL: All MongoDB connection attempts failed.");
        process.exit(1);
      }

      console.log(`Retrying MongoDB connection in ${RETRY_INTERVAL_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
};