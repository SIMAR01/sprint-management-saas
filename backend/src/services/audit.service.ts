import { addAuditJob, AuditJobData } from "../queues/audit.queue";
import { AuditLog, IAuditLog } from "../models/auditLog.model";

export interface AuditQueryOptions {
  resourceId?: string;
  resourceType?: string;
  actorUserId?: string;
  action?: string;
  correlationId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  logs: IAuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class AuditService {
  /**
   * Dispatches an audit event asynchronously to the BullMQ audit queue.
   * Completely decoupled from the synchronous HTTP request cycle.
   */
  public static async recordLog(data: AuditJobData): Promise<void> {
    await addAuditJob(data);
  }

  /**
   * Retrieves paginated audit logs based on search/filter criteria.
   */
  public static async getAuditLogs(options: AuditQueryOptions): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (options.resourceId) {
      filter["resource.id"] = options.resourceId;
    }
    if (options.resourceType) {
      filter["resource.type"] = options.resourceType.toUpperCase();
    }
    if (options.actorUserId) {
      filter["actor.userId"] = options.actorUserId;
    }
    if (options.action) {
      filter.action = options.action;
    }
    if (options.correlationId) {
      filter["context.correlationId"] = options.correlationId;
    }
    if (options.startDate || options.endDate) {
      filter.createdAt = {};
      if (options.startDate) {
        filter.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        filter.createdAt.$lte = new Date(options.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs: logs as unknown as IAuditLog[],
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
