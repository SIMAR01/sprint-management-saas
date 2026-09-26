# Production-Grade Audit Logging & BullMQ Asynchronous Processing Pipeline

## 1. Overview & Architecture

TeamFlow SaaS uses an asynchronous, resilient, and horizontally scalable event-driven pipeline designed for high-throughput sprint collaboration.

```
                    ┌─────────────────────────┐
                    │  Incoming HTTP Request  │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────▼───────────────┐
                 │    Correlation Middleware     │ (Assigns & passes x-correlation-id)
                 └───────────────┬───────────────┘
                                 │
                 ┌───────────────▼───────────────┐
                 │ Auth & RBAC Security Guards   │
                 └───────────────┬───────────────┘
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     │                                                       │
┌────▼─────────────────────┐                    ┌────────────▼──────────────┐
│ Fast Sync HTTP Response  │                    │ BullMQ Background Queues  │
│ (Cache-aside + DB write) │                    │ (Isolated Redis Cluster)  │
└──────────────────────────┘                    └────────────┬──────────────┘
                                                             │
                              ┌──────────────────────────────┼──────────────────────────────┐
                              │                              │                              │
                     ┌────────▼────────┐            ┌────────▼────────┐            ┌────────▼────────┐
                     │   Audit Queue   │            │  Notification Q │            │   Email Queue   │
                     │ (audit-logs)    │            │ (notifications) │            │    (emails)     │
                     └────────┬────────┘            └────────┬────────┘            └────────┬────────┘
                              │                              │                              │
                     ┌────────▼────────┐            ┌────────▼────────┐            ┌────────▼────────┐
                     │  Audit Worker   │            │ Notif Worker    │            │  Email Worker   │
                     │ (Immutable DB)  │            │ (Inbox + Socket)│            │ (SendGrid API)  │
                     └─────────────────┘            └─────────────────┘            └─────────────────┘
```

---

## 2. Production-Grade Audit Logging System

### 2.1 Immutable Data Model (`src/models/auditLog.model.ts`)
Audit logs are stored in a dedicated `audit_logs` MongoDB collection with strict database-level immutability constraints.

```typescript
export interface IAuditLog {
  action: string;
  actor: {
    userId: string;
    email: string;
    role: string;
  };
  resource: {
    type: "PROJECT" | "TASK" | "USER" | "SESSION";
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
  createdAt: Date;
}
```

### 2.2 Immutability Guarantees
Mongoose query middleware intercepts and rejects mutating and destructive operations:
- `updateOne`
- `updateMany`
- `findOneAndUpdate`
- `deleteOne`
- `deleteMany`
- `findOneAndDelete`

Attempts to modify or delete existing audit entries will throw a fatal rejection error.

### 2.3 High-Performance Query Indexes
- `{ "resource.id": 1, createdAt: -1 }`: Fast timeline lookups for tasks and projects.
- `{ "actor.userId": 1 }`: Quick user action audit filtering.
- `{ action: 1, createdAt: -1 }`: Efficient action-level categorization.
- `{ "context.correlationId": 1 }`: End-to-end request trace lookups.

---

## 3. Asynchronous Job Processing Pipeline (BullMQ)

### 3.1 Dedicated Queues (`src/queues/`)
1. **`audit.queue.ts` (`audit-logs`)**: Offloads disk-heavy audit writes from HTTP request cycles.
2. **`notification.queue.ts` (`notifications`)**: Persists in-app user notifications and broadcasts real-time WebSocket events.
3. **`email.queue.ts` (`emails`)**: Manages transactional email delivery via SendGrid with automatic rate handling.

### 3.2 Retry Strategy & Backoff Configuration
All queues use standardized exponential backoff policies to tolerate temporary third-party API or network glitches:
- **Max Attempts**: `5`
- **Backoff Strategy**: Exponential (`delay: 2000ms`, doubling on subsequent retries)
- **Job Retention**: Auto-cleanup keeping the last 1,000 successful and 5,000 failed jobs for auditing.

### 3.3 Dead Letter Queue (DLQ) Hook
When a job fails after exhausting all 5 attempts, the worker's `failed` event triggers DLQ logging:
```json
{
  "jobId": "audit-a4f80164-8b63-4c91-b3b3-85f2479e0a2f",
  "action": "TASK_STATUS_UPDATED",
  "actor": { "userId": "user-123", "email": "dev@teamflow.app" },
  "correlationId": "a4f80164-8b63-4c91-b3b3-85f2479e0a2f",
  "attemptsMade": 5,
  "error": "Database write timeout",
  "timestamp": "2026-09-27T00:15:00.000Z"
}
```

### 3.4 Graceful Shutdown Lifecycle
`server.ts` handles `SIGTERM` and `SIGINT` signals by orchestrating a 4-step clean termination:
1. Stops accepting incoming HTTP connections (`server.close()`).
2. Closes BullMQ workers (`worker.close()`), allowing in-flight jobs to complete processing.
3. Closes Redis client connections (`closeRedisConnections()`).
4. Disconnects MongoDB connections cleanly (`mongoose.disconnect()`).

---

## 4. Redis Architecture & Cache-Aside Strategy

### 4.1 Connection Isolation (`src/config/redis.config.ts`)
- **`cacheRedisClient`**: Dedicated `ioredis` client instance for application-level caching, rate limiting, and session stores.
- **`bullMqProducerConnection`**: Dedicated connection options for BullMQ queue dispatchers.
- **`bullMqWorkerConnection`**: Worker connection options configured with `maxRetriesPerRequest: null`.

### 4.2 Cache-Aside Engine (`src/utils/cache.ts`)
- **High-Frequency Read Caching**:
  - `getProjectTasks`: Cached under `cache:project:{projectId}:tasks:{page}:{limit}:{status}` with a 60-second TTL.
  - `getProjectTimeline`: Cached under `cache:project:{projectId}:timeline` with a 30-second TTL.
- **Proactive Invalidation Hooks**:
  - Any task mutation (create, status transition, update, delete, attachment deletion) automatically invalidates `cache:project:{projectId}:tasks:*`.
  - Any project mutation (update, archive, delete, member invite/eviction) automatically clears all project cache keys.

---

## 5. Docker Infrastructure Setup

### 5.1 Redis Production Configuration (`docker-compose.yml`)
```yaml
  redis:
    image: redis:8-alpine
    container_name: redis
    command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec", "--maxmemory", "512mb", "--maxmemory-policy", "noeviction"]
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 3s
    restart: unless-stopped
```

### 5.2 Environment Variables (`.env.example`)
```ini
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
BULLMQ_CONCURRENCY=10
```
