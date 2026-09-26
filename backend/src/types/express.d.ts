declare namespace Express {
  interface Request {
    // Unique correlation ID for tracing the request across logs, workers, and external calls
    correlationId?: string;
    // Actor context for audit logging
    actor?: {
      userId: string;
      email: string;
      role: string;
    };
    // The authenticated user profile attached by the Auth middleware
    user?: Omit<import("../models/user.model").IUser, "password" | "refreshTokens">;
    // The current access token string attached by the Auth middleware (useful for revocation check)
    token?: string;
    // The current project document resolved by RBAC / membership middleware
    project?: import("../models/project.model").IProject;
    // The current task document resolved by task-level middleware (optional)
    task?: import("../models/task.model").ITask;
  }
}
