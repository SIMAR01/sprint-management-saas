export interface AuditActor {
  userId: string;
  email: string;
  role: string;
}

export interface AuditResource {
  type: string;
  id: string;
  name?: string;
}

export interface AuditContext {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface AuditDiff {
  before?: Record<string, any>;
  after?: Record<string, any>;
}

export interface AuditLogItem {
  _id: string;
  action: string;
  actor: AuditActor;
  resource: AuditResource;
  context: AuditContext;
  diff?: AuditDiff;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAuditResponse {
  statusCode: number;
  data: {
    logs: AuditLogItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
  message: string;
  success: boolean;
}

export interface AuditFilterParams {
  page?: number;
  limit?: number;
  resourceId?: string;
  resourceType?: string;
  actorUserId?: string;
  action?: string;
  correlationId?: string;
  startDate?: string;
  endDate?: string;
}
