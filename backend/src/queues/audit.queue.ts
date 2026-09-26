import { Queue, JobsOptions } from "bullmq";
import { bullMqProducerConnection } from "../config/redis.config";

export interface AuditJobData {
  action: string;
  actor: {
    userId: string;
    email: string;
    role: string;
  };
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  context: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
  diff?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
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

export const auditQueue = new Queue<AuditJobData, any, string>("audit-logs", {
  connection: bullMqProducerConnection,
  defaultJobOptions,
});

export const addAuditJob = async (data: AuditJobData): Promise<void> => {
  try {
    await auditQueue.add("record-audit-log", data, {
      jobId: data.context.correlationId ? `audit-${data.context.correlationId}-${Date.now()}` : undefined,
    });
  } catch (err: any) {
    console.error("[AuditQueue] Failed to dispatch audit job:", err.message);
  }
};
