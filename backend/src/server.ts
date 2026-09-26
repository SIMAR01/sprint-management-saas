import dotenv from "dotenv";
dotenv.config();
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import app from "./app";
import { connectDB } from "./config/database";
import { connectRedisConfig, closeRedisConnections } from "./config/redis.config";
import { socketAuthMiddleware } from "./sockets/auth.socket";
import { setIoInstance, registerProjectSocketHandlers } from "./sockets/project.socket";
import { startWorkers, stopWorkers } from "./workers";

const PORT = process.env.PORT || 5000;

let server: http.Server;

const startServer = async () => {
  try {
    // 1. Establish MongoDB Connection
    await connectDB();

    // 2. Establish Redis Connection (ioredis)
    await connectRedisConfig();

    // 3. Initialize BullMQ Background Workers
    startWorkers();

    // 4. Create HTTP Server wrapping Express App
    server = http.createServer(app);

    // 5. Initialize Socket.IO Server
    const io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
      },
    });

    // Save running server instance to the project socket registry
    setIoInstance(io);

    // 6. Register Socket.IO Handshake Authentication Middleware
    io.use(socketAuthMiddleware);

    // 7. Connect Socket Event Listeners
    io.on("connection", (socket) => {
      const user = (socket as any).user;
      console.log(`Socket client connected: ${user.username} (ID: ${user.id})`);

      // Register project workspace room membership listeners
      registerProjectSocketHandlers(io, socket);

      socket.on("disconnect", () => {
        console.log(`Socket client disconnected: ${user.username} (ID: ${user.id})`);
      });
    });

    // 8. Start Listening
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
    });
  } catch (error) {
    console.error("Startup Error:", error);
    process.exit(1);
  }
};

/**
 * Production Graceful Shutdown Handlers.
 * Ensures active HTTP requests, BullMQ jobs, and Redis/Mongo connections terminate cleanly.
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Shutdown] Received signal: ${signal}. Initiating graceful shutdown...`);

  try {
    // 1. Stop accepting new HTTP requests
    if (server) {
      await new Promise<void>((resolve) => {
        server.close((err) => {
          if (err) console.warn("[Shutdown] HTTP server close error:", err.message);
          else console.log("[Shutdown] HTTP server closed.");
          resolve();
        });
      });
    }

    // 2. Wait for active BullMQ workers to finish jobs
    await stopWorkers();

    // 3. Close Redis connection pools
    await closeRedisConnections();

    // 4. Close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("[Shutdown] MongoDB disconnected.");
    }

    console.log("[Shutdown] Graceful shutdown completed cleanly. Exiting.");
    process.exit(0);
  } catch (err: any) {
    console.error("[Shutdown] Error during shutdown:", err.message);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();