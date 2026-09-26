import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { AuditController } from "../controllers/audit.controller";
import { getAuditLogsQuerySchema } from "../validations/audit.validation";
import { protect } from "../middleware/auth.middleware";

const router = Router({ mergeParams: true });

// Protect all audit querying routes with authentication
router.use(protect);

// GET /api/v1/audit or GET /api/v1/projects/:projectId/audit
router.get(
  "/",
  validate(getAuditLogsQuerySchema),
  AuditController.getLogs
);

export default router;
