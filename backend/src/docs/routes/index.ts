import { authDocs } from "./auth.docs";
import { healthDocs } from "./health.docs";
import { projectDocs } from "./project.docs";
import { taskDocs } from "./task.docs";
import { notificationDocs } from "./notification.docs";
import { auditDocs } from "./audit.docs";

/**
 * Aggregates all modular route documentation into a unified OpenAPI paths dictionary.
 */
export const apiPaths = {
  ...healthDocs,
  ...authDocs,
  ...projectDocs,
  ...taskDocs,
  ...notificationDocs,
  ...auditDocs,
};
