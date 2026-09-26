import { Worker, Job } from "bullmq";
import { bullMqWorkerConnection } from "../config/redis.config";
import { AuditLog } from "../models/auditLog.model";
import { AuditJobData } from "../queues/audit.queue";
import { env } from "../config/env";

export const createAuditWorker = (): Worker<AuditJobData> => {
  const worker = new Worker<AuditJobData>(
    "audit-logs",
    async (job: Job<AuditJobData>) => {
      const { action, actor, resource, context, diff, metadata } = job.data;

      // Persist immutable audit log entry into MongoDB
      await AuditLog.create({
        action,
        actor,
        resource,
        context,
        diff,
        metadata,
      });

      return { success: true, action, resourceId: resource.id };
    },
    {
      connection: bullMqWorkerConnection,
      concurrency: env.BULLMQ_CONCURRENCY,
    }
  );

  worker.on("completed", (job: Job<AuditJobData>) => {
    // completed silently or debug log
  });

  // ─── Dead Letter Queue (DLQ) Hook for Fatal Processing Failures ───────────
  worker.on("failed", (job: Job<AuditJobData> | undefined, err: Error) => {
    if (!job) {
      console.error("[AuditWorker DLQ] Unknown job encountered fatal error:", err.message);
      return;
    }

    const isFatal = job.attemptsMade >= (job.opts.attempts || 5);
    if (isFatal) {
      console.error("[AuditWorker DLQ FATAL]", {
        jobId: job.id,
        action: job.data.action,
        actor: job.data.actor,
        resource: job.data.resource,
        correlationId: job.data.context?.correlationId,
        attemptsMade: job.attemptsMade,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.warn(`[AuditWorker] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
    }
  });

  worker.on("error", (err: Error) => {
    console.error("[AuditWorker] Internal worker error:", err.message);
  });

  return worker;
};
