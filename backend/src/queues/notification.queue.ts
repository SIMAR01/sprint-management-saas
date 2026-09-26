import { Queue, JobsOptions } from "bullmq";
import { bullMqProducerConnection } from "../config/redis.config";

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  message: string;
  projectId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
  socketEvent?: {
    room?: string;
    event: string;
    payload: any;
  };
}

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 5000,
  },
};

export const notificationQueue = new Queue<NotificationJobData, any, string>("notifications", {
  connection: bullMqProducerConnection,
  defaultJobOptions,
});

export const addNotificationJob = async (data: NotificationJobData): Promise<void> => {
  try {
    await notificationQueue.add("send-notification", data);
  } catch (err: any) {
    console.error("[NotificationQueue] Failed to enqueue notification job:", err.message);
  }
};
