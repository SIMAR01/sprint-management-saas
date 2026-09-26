import { Worker, Job } from "bullmq";
import { bullMqWorkerConnection } from "../config/redis.config";
import { Notification, NotificationType } from "../models/notification.model";
import { NotificationJobData } from "../queues/notification.queue";
import { emitProjectEvent, emitUserEvent } from "../sockets/project.socket";
import { env } from "../config/env";

export const createNotificationWorker = (): Worker<NotificationJobData> => {
  const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job: Job<NotificationJobData>) => {
      const { userId, type, title, message, projectId, taskId, metadata, socketEvent } = job.data;

      // 1. Persist in-app notification record
      const notification = await Notification.create({
        userId,
        type: type as NotificationType,
        title,
        message,
        projectId: projectId || null,
        taskId: taskId || null,
        data: metadata || {},
      });

      // 2. Emit real-time notification to user's private socket room
      emitUserEvent(userId, "notification:new", {
        notificationId: notification.notificationId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        projectId: notification.projectId,
        taskId: notification.taskId,
        data: notification.data,
        createdAt: notification.createdAt,
      });

      // 3. If a specific room socket event was requested, broadcast to the project room
      if (socketEvent) {
        if (socketEvent.room) {
          emitProjectEvent(socketEvent.room.replace("project:", ""), socketEvent.event, socketEvent.payload);
        } else if (projectId) {
          emitProjectEvent(projectId, socketEvent.event, socketEvent.payload);
        }
      }

      return { success: true, notificationId: notification.notificationId };
    },
    {
      connection: bullMqWorkerConnection,
      concurrency: env.BULLMQ_CONCURRENCY,
    }
  );

  // ─── Dead Letter Queue (DLQ) Hook for Fatal Notification Failures ─────────
  worker.on("failed", (job: Job<NotificationJobData> | undefined, err: Error) => {
    if (!job) {
      console.error("[NotificationWorker DLQ] Unknown job failed:", err.message);
      return;
    }

    const isFatal = job.attemptsMade >= (job.opts.attempts || 5);
    if (isFatal) {
      console.error("[NotificationWorker DLQ FATAL]", {
        jobId: job.id,
        userId: job.data.userId,
        type: job.data.type,
        title: job.data.title,
        attemptsMade: job.attemptsMade,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.warn(`[NotificationWorker] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
    }
  });

  worker.on("error", (err: Error) => {
    console.error("[NotificationWorker] Internal worker error:", err.message);
  });

  return worker;
};
