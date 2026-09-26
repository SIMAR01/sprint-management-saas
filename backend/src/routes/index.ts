import { Router } from "express";
import authRouter from "./auth.routes";
import projectRouter from "./project.routes";
import notificationRouter from "./notification.routes";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Register auth routes under v1/auth
router.use("/auth", authRouter);

// Register project workspace routes under v1/projects
router.use("/projects", protect, projectRouter);

// Register notification inbox routes under v1/notifications
router.use("/notifications", protect, notificationRouter);

export default router;
