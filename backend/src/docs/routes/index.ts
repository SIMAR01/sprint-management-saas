import { authDocs } from "./auth.docs";
import { healthDocs } from "./health.docs";

/**
 * Aggregates all modular route documentation into a unified OpenAPI paths dictionary.
 *
 * To add documentation for future API modules (Workspaces, Projects, Tasks, etc.):
 * 1. Create a dedicated file under `src/docs/routes/<module>.docs.ts`
 * 2. Export its paths object
 * 3. Spread it here into `apiPaths`
 *
 * This keeps each API module isolated, maintainable, and type-safe.
 */
export const apiPaths = {
  ...healthDocs,
  ...authDocs,
  // Future API Modules will be spread here seamlessly:
  // ...workspaceDocs,
  // ...projectDocs,
  // ...boardDocs,
  // ...taskDocs,
  // ...commentDocs,
  // ...notificationDocs,
  // ...fileDocs,
  // ...searchDocs,
  // ...auditDocs,
  // ...analyticsDocs,
};
