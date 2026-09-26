import { Worker, Job } from "bullmq";
import { bullMqWorkerConnection } from "../config/redis.config";
import { sendEmail } from "../utils/sendgrid";
import { EmailJobData } from "../queues/email.queue";
import { env } from "../config/env";

export const createEmailWorker = (): Worker<EmailJobData> => {
  const worker = new Worker<EmailJobData>(
    "emails",
    async (job: Job<EmailJobData>) => {
      const { to, subject, html, text, correlationId } = job.data;

      const result = await sendEmail({
        to,
        subject,
        html,
        text,
      });

      if (!result.success) {
        throw new Error(`Email delivery failed to ${to}: ${result.error || "Unknown error"}`);
      }

      return { success: true, to, subject, correlationId };
    },
    {
      connection: bullMqWorkerConnection,
      concurrency: env.BULLMQ_CONCURRENCY,
    }
  );

  // ─── Dead Letter Queue (DLQ) Hook for Fatal Email Delivery Failures ───────
  worker.on("failed", (job: Job<EmailJobData> | undefined, err: Error) => {
    if (!job) {
      console.error("[EmailWorker DLQ] Unknown job encountered fatal error:", err.message);
      return;
    }

    const isFatal = job.attemptsMade >= (job.opts.attempts || 5);
    if (isFatal) {
      console.error("[EmailWorker DLQ FATAL]", {
        jobId: job.id,
        to: job.data.to,
        subject: job.data.subject,
        correlationId: job.data.correlationId,
        attemptsMade: job.attemptsMade,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.warn(`[EmailWorker] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
    }
  });

  worker.on("error", (err: Error) => {
    console.error("[EmailWorker] Internal worker error:", err.message);
  });

  return worker;
};
