import { Queue, JobsOptions } from "bullmq";
import { bullMqProducerConnection } from "../config/redis.config";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  correlationId?: string;
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

export const emailQueue = new Queue<EmailJobData, any, string>("emails", {
  connection: bullMqProducerConnection,
  defaultJobOptions,
});

export const addEmailJob = async (data: EmailJobData): Promise<void> => {
  try {
    await emailQueue.add("send-email", data, {
      jobId: data.correlationId ? `email-${data.correlationId}-${Date.now()}` : undefined,
    });
  } catch (err: any) {
    console.error("[EmailQueue] Failed to enqueue email job:", err.message);
  }
};
