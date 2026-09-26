import { Worker } from "bullmq";
import { createAuditWorker } from "./audit.worker";
import { createNotificationWorker } from "./notification.worker";
import { createEmailWorker } from "./email.worker";

let workers: Worker[] = [];

/**
 * Boots up all BullMQ workers.
 */
export const startWorkers = (): void => {
  if (workers.length > 0) {
    console.log("[Workers] BullMQ workers are already running.");
    return;
  }

  console.log("[Workers] Starting BullMQ workers for Audit, Notification, and Email queues...");
  const auditWorker = createAuditWorker();
  const notificationWorker = createNotificationWorker();
  const emailWorker = createEmailWorker();

  workers = [auditWorker, notificationWorker, emailWorker];
  console.log(`[Workers] ${workers.length} BullMQ workers initialized and actively listening.`);
};

/**
 * Gracefully shuts down all running BullMQ workers, ensuring in-flight jobs complete.
 */
export const stopWorkers = async (): Promise<void> => {
  if (workers.length === 0) {
    return;
  }

  console.log("[Workers] Gracefully stopping BullMQ workers...");
  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
        console.log(`[Workers] Worker '${worker.name}' closed successfully.`);
      } catch (err: any) {
        console.warn(`[Workers] Error closing worker '${worker.name}':`, err.message);
      }
    })
  );

  workers = [];
  console.log("[Workers] All BullMQ workers stopped.");
};
