import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { AuditService } from "../services/audit.service";

export class AuditController {
  /**
   * Retrieves paginated audit logs with flexible filtering options.
   */
  public static getLogs = asyncHandler(async (req: Request, res: Response) => {
    const {
      resourceId,
      resourceType,
      actorUserId,
      action,
      correlationId,
      startDate,
      endDate,
      page,
      limit,
    } = req.query as any;

    const projectIdParam = req.params.projectId;
    const targetResourceId = resourceId || projectIdParam;

    const result = await AuditService.getAuditLogs({
      resourceId: targetResourceId,
      resourceType,
      actorUserId,
      action,
      correlationId,
      startDate,
      endDate,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json(
      new ApiResponse(200, result, "Audit logs retrieved successfully")
    );
  });
}
