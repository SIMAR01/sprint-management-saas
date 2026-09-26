import { z } from "zod";

export const getAuditLogsQuerySchema = z.object({
  query: z.object({
    resourceId: z.string().optional(),
    resourceType: z.string().optional(),
    actorUserId: z.string().optional(),
    action: z.string().optional(),
    correlationId: z.string().optional(),
    startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
    endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a positive integer")
      .transform(Number)
      .optional()
      .default(1 as any),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive integer")
      .transform(Number)
      .optional()
      .default(20 as any),
  }),
});

export type GetAuditLogsQueryInput = z.infer<typeof getAuditLogsQuerySchema>;
