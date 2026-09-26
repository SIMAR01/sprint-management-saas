import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAuditActor {
  userId: mongoose.Types.ObjectId | string;
  email: string;
  role: string;
}

export interface IAuditResource {
  type: string; // e.g., "PROJECT", "TASK", "USER", "SESSION"
  id: mongoose.Types.ObjectId | string;
  name?: string;
}

export interface IAuditContext {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface IAuditDiff {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface IAuditLog extends Document {
  action: string;
  actor: IAuditActor;
  resource: IAuditResource;
  context: IAuditContext;
  diff?: IAuditDiff;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema: Schema<IAuditLog> = new Schema(
  {
    action: {
      type: String,
      required: [true, "Audit action is required"],
      trim: true,
      index: true,
    },
    actor: {
      userId: {
        type: Schema.Types.Mixed,
        required: [true, "Actor user ID is required"],
        index: true,
      },
      email: {
        type: String,
        required: [true, "Actor email is required"],
        trim: true,
        lowercase: true,
      },
      role: {
        type: String,
        required: [true, "Actor role is required"],
        trim: true,
      },
    },
    resource: {
      type: {
        type: String,
        required: [true, "Resource type is required"],
        trim: true,
        uppercase: true,
      },
      id: {
        type: Schema.Types.Mixed,
        required: [true, "Resource ID is required"],
      },
      name: {
        type: String,
        trim: true,
      },
    },
    context: {
      ip: {
        type: String,
        trim: true,
      },
      userAgent: {
        type: String,
        trim: true,
      },
      correlationId: {
        type: String,
        trim: true,
        index: true,
      },
    },
    diff: {
      before: {
        type: Schema.Types.Mixed,
        default: undefined,
      },
      after: {
        type: Schema.Types.Mixed,
        default: undefined,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes for High-Performance Audit Queries ─────────────────────────────
AuditLogSchema.index({ "resource.id": 1, createdAt: -1 });
AuditLogSchema.index({ "actor.userId": 1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

// ─── Immutability Constraints: Block all Updates & Deletions ─────────────────
const blockMutation = function (this: any, next: (err?: Error) => void) {
  const error = new Error("FATAL: AuditLog records are strictly immutable. Modifications and deletions are prohibited.");
  next(error);
};

(AuditLogSchema as any).pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"],
  blockMutation
);

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
export default AuditLog;
