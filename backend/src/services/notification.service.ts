import { INotification, Notification, NotificationType } from "../models/notification.model";
import { User, IUser } from "../models/user.model";
import { Project } from "../models/project.model";
import { env } from "../config/env";
import { sendEmail } from "../utils/sendgrid";
import {
  getProjectCreatedEmail,
  getMemberInvitedEmail,
  getMemberRemovedEmail,
  getTaskCreatedEmail,
  getTaskUpdatedEmail,
  getDeletionEmail,
} from "../utils/emailTemplates";
import { emitUserEvent } from "../sockets/project.socket";
import { ApiError } from "../utils/ApiError";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecipientUser {
  userId: string;
  email: string;
  name: string;
  username?: string;
  role?: string;
}

export interface GetNotificationsQuery {
  page: number;
  limit: number;
  isRead?: boolean;
  type?: NotificationType;
  projectId?: string;
}

export interface PaginatedNotifications {
  notifications: INotification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class NotificationService {
  // ─── Recipient Discovery Helpers ───────────────────────────────────────────

  /**
   * Discovers all administrator users (system-level admins).
   */
  public static async getAdminUsers(): Promise<RecipientUser[]> {
    const adminDocs = await User.find({ role: "admin" }).lean();
    const adminMap = new Map<string, RecipientUser>();

    for (const doc of adminDocs) {
      adminMap.set(doc.uuid.id, {
        userId: doc.uuid.id,
        email: doc.email,
        name: doc.name,
        username: doc.username,
        role: "admin",
      });
    }

    // Also match any configured ADMIN_EMAILS in env if not already matched
    if (env.ADMIN_EMAILS && env.ADMIN_EMAILS.length > 0) {
      const emailAdmins = await User.find({
        email: { $in: env.ADMIN_EMAILS },
      }).lean();

      for (const doc of emailAdmins) {
        if (!adminMap.has(doc.uuid.id)) {
          adminMap.set(doc.uuid.id, {
            userId: doc.uuid.id,
            email: doc.email,
            name: doc.name,
            username: doc.username,
            role: "admin",
          });
        }
      }
    }

    return Array.from(adminMap.values());
  }

  /**
   * Discovers the Project Manager(s) and Owner for a specific project.
   */
  public static async getProjectManagers(projectId: string): Promise<RecipientUser[]> {
    const project = await Project.findOne({ projectId, isDeleted: { $ne: true } }).lean();
    if (!project) return [];

    const pmUserIds = new Set<string>();
    if (project.owner) pmUserIds.add(project.owner);

    if (project.members && Array.isArray(project.members)) {
      for (const m of project.members) {
        if (m.role === "ProjectManager") {
          pmUserIds.add(m.userId);
        }
      }
    }

    if (pmUserIds.size === 0) return [];

    const users = await User.find({ "uuid.id": { $in: Array.from(pmUserIds) } }).lean();

    return users.map((u) => ({
      userId: u.uuid.id,
      email: u.email,
      name: u.name,
      username: u.username,
      role: "ProjectManager",
    }));
  }

  /**
   * Retrieves user profile details by user UUID.
   */
  public static async getUserById(userId?: string | null): Promise<RecipientUser | null> {
    if (!userId) return null;
    const user = await User.findOne({ "uuid.id": userId }).lean();
    if (!user) return null;

    return {
      userId: user.uuid.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
    };
  }

  // ─── Central Dispatcher ───────────────────────────────────────────────────

  /**
   * Creates in-app notifications, emits real-time Socket events, and dispatches SendGrid emails.
   * Modularized to easily plug into BullMQ background queues in the next phase.
   */
  public static async dispatchNotification(params: {
    recipients: RecipientUser[];
    title: string;
    message: string;
    type: NotificationType;
    projectId?: string | null;
    taskId?: string | null;
    data?: Record<string, any>;
    emailPayload?: { subject: string; html: string; text: string };
  }): Promise<INotification[]> {
    const { recipients, title, message, type, projectId, taskId, data = {}, emailPayload } = params;

    // Deduplicate recipients by userId
    const uniqueRecipients = new Map<string, RecipientUser>();
    for (const r of recipients) {
      if (r && r.userId && r.email) {
        uniqueRecipients.set(r.userId, r);
      }
    }

    const recipientList = Array.from(uniqueRecipients.values());
    if (recipientList.length === 0) return [];

    // 1. Create In-App Notification records in MongoDB
    const docsToInsert = recipientList.map((r) => ({
      userId: r.userId,
      projectId: projectId || null,
      taskId: taskId || null,
      title,
      message,
      type,
      data: {
        ...data,
        recipientName: r.name,
        recipientEmail: r.email,
      },
      isRead: false,
    }));

    const savedNotifications = await Notification.insertMany(docsToInsert);

    // 2. Real-Time Socket Broadcast to each user's private channel
    for (const notif of savedNotifications) {
      emitUserEvent(notif.userId, "notification:new", notif);
    }

    // 3. Dispatch SendGrid Email with professional HTML template
    if (emailPayload) {
      const emailAddresses = recipientList.map((r) => r.email);
      // Asynchronously send emails (fail-safe without blocking main response)
      sendEmail({
        to: emailAddresses,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text,
      }).catch((err) => {
        console.error("[NotificationService] SendGrid email dispatch error:", err);
      });
    }

    return savedNotifications;
  }

  // ─── Domain Event Triggers ─────────────────────────────────────────────────

  /**
   * Trigger 1: Project Workspace Created
   * Recipients: Admin(s) and ProjectManager (Creator).
   */
  public static async notifyProjectCreated(
    projectId: string,
    projectName: string,
    creatorId: string,
    description?: string
  ): Promise<void> {
    try {
      const creator = await NotificationService.getUserById(creatorId);
      const admins = await NotificationService.getAdminUsers();

      const recipients: RecipientUser[] = [];
      if (creator) recipients.push(creator);
      for (const a of admins) recipients.push(a);

      const creatorName = creator?.name || "A Project Manager";
      const creatorEmail = creator?.email || "";

      const title = `Project Workspace Created: ${projectName}`;
      const message = `${creatorName} created a new project workspace '${projectName}'.`;

      const emailPayload = getProjectCreatedEmail({
        projectId,
        projectName,
        creatorName,
        creatorEmail,
        description,
      });

      await NotificationService.dispatchNotification({
        recipients,
        title,
        message,
        type: "PROJECT_CREATED",
        projectId,
        data: { projectId, projectName, creatorId, creatorName, creatorEmail, description },
        emailPayload,
      });
    } catch (err) {
      console.error("[NotificationService] notifyProjectCreated failed:", err);
    }
  }

  /**
   * Trigger 2A: Member Invited to Project Workspace
   * Recipients: Admin(s), ProjectManager(s), and the Invited Member.
   */
  public static async notifyMemberInvited(
    projectId: string,
    projectName: string,
    memberId: string,
    role: string,
    inviterId: string
  ): Promise<void> {
    try {
      const member = await NotificationService.getUserById(memberId);
      const inviter = await NotificationService.getUserById(inviterId);
      const pms = await NotificationService.getProjectManagers(projectId);
      const admins = await NotificationService.getAdminUsers();

      const recipients: RecipientUser[] = [];
      if (member) recipients.push(member);
      for (const pm of pms) recipients.push(pm);
      for (const a of admins) recipients.push(a);

      const memberName = member?.name || "New Member";
      const memberEmail = member?.email || "";
      const inviterName = inviter?.name || "Workspace Admin";

      const title = `Team Member Added: ${memberName}`;
      const message = `${memberName} was added to project '${projectName}' as ${role} by ${inviterName}.`;

      const emailPayload = getMemberInvitedEmail({
        projectId,
        projectName,
        memberName,
        memberEmail,
        role,
        inviterName,
      });

      await NotificationService.dispatchNotification({
        recipients,
        title,
        message,
        type: "MEMBER_INVITED",
        projectId,
        data: { projectId, projectName, memberId, memberName, memberEmail, role, inviterId, inviterName },
        emailPayload,
      });
    } catch (err) {
      console.error("[NotificationService] notifyMemberInvited failed:", err);
    }
  }

  /**
   * Trigger 2B: Member Removed from Project Workspace
   * Recipients: Admin(s), ProjectManager(s), and the Removed Member.
   */
  public static async notifyMemberRemoved(
    projectId: string,
    projectName: string,
    memberId: string,
    actorId: string
  ): Promise<void> {
    try {
      const member = await NotificationService.getUserById(memberId);
      const actor = await NotificationService.getUserById(actorId);
      const pms = await NotificationService.getProjectManagers(projectId);
      const admins = await NotificationService.getAdminUsers();

      const recipients: RecipientUser[] = [];
      if (member) recipients.push(member);
      for (const pm of pms) recipients.push(pm);
      for (const a of admins) recipients.push(a);

      const memberName = member?.name || "Team Member";
      const memberEmail = member?.email || "";
      const actorName = actor?.name || "Workspace Admin";

      const title = `Member Removed from ${projectName}`;
      const message = `${memberName} was removed from project '${projectName}' by ${actorName}.`;

      const emailPayload = getMemberRemovedEmail({
        projectId,
        projectName,
        memberName,
        memberEmail,
        actorName,
      });

      await NotificationService.dispatchNotification({
        recipients,
        title,
        message,
        type: "MEMBER_REMOVED",
        projectId,
        data: { projectId, projectName, memberId, memberName, memberEmail, actorId, actorName },
        emailPayload,
      });
    } catch (err) {
      console.error("[NotificationService] notifyMemberRemoved failed:", err);
    }
  }

  /**
   * Trigger 3A: Task Created
   * Recipients: Admin(s), ProjectManager(s), and Assignee (if assigned).
   */
  public static async notifyTaskCreated(
    projectId: string,
    projectName: string,
    taskId: string,
    taskTitle: string,
    creatorId: string,
    assigneeId?: string | null,
    status: string = "todo",
    imagesCount: number = 0,
    hasVideo: boolean = false
  ): Promise<void> {
    try {
      const creator = await NotificationService.getUserById(creatorId);
      const assignee = await NotificationService.getUserById(assigneeId);
      const pms = await NotificationService.getProjectManagers(projectId);
      const admins = await NotificationService.getAdminUsers();

      const recipients: RecipientUser[] = [];
      if (assignee) recipients.push(assignee);
      for (const pm of pms) recipients.push(pm);
      for (const a of admins) recipients.push(a);

      const creatorName = creator?.name || "Team Member";
      const assigneeName = assignee?.name || null;

      const title = `New Task: "${taskTitle}"`;
      const message = `${creatorName} created task '${taskTitle}' in '${projectName}' (Status: ${status.toUpperCase()}).`;

      const emailPayload = getTaskCreatedEmail({
        projectId,
        projectName,
        taskId,
        taskTitle,
        creatorName,
        assigneeName,
        status,
        imagesCount,
        hasVideo,
      });

      await NotificationService.dispatchNotification({
        recipients,
        title,
        message,
        type: "TASK_CREATED",
        projectId,
        taskId,
        data: { projectId, projectName, taskId, taskTitle, creatorId, creatorName, assigneeId, assigneeName, status },
        emailPayload,
      });
    } catch (err) {
      console.error("[NotificationService] notifyTaskCreated failed:", err);
    }
  }

  /**
   * Trigger 3B: Task Updated / Media Uploaded / Status Changed / Reassigned
   * Recipients: Admin(s), ProjectManager(s), Assignee(s).
   */
  public static async notifyTaskUpdated(params: {
    projectId: string;
    projectName: string;
    taskId: string;
    taskTitle: string;
    actorId: string;
    updates: {
      status?: string;
      previousStatus?: string;
      assigneeId?: string | null;
      previousAssigneeId?: string | null;
      images?: string[];
      previousImages?: string[];
      videoUrl?: string | null;
      previousVideoUrl?: string | null;
      title?: string;
      description?: string | null;
    };
  }): Promise<void> {
    try {
      const { projectId, projectName, taskId, taskTitle, actorId, updates } = params;

      const actor = await NotificationService.getUserById(actorId);
      const currentAssignee = await NotificationService.getUserById(updates.assigneeId);
      const prevAssignee = await NotificationService.getUserById(updates.previousAssigneeId);
      const pms = await NotificationService.getProjectManagers(projectId);
      const admins = await NotificationService.getAdminUsers();

      const recipients: RecipientUser[] = [];
      if (currentAssignee) recipients.push(currentAssignee);
      if (prevAssignee && prevAssignee.userId !== currentAssignee?.userId) recipients.push(prevAssignee);
      for (const pm of pms) recipients.push(pm);
      for (const a of admins) recipients.push(a);

      const actorName = actor?.name || "Team Member";

      // Formulate human-friendly changes summary
      const changes: string[] = [];
      let notifType: NotificationType = "TASK_UPDATED";

      if (updates.status && updates.previousStatus && updates.status !== updates.previousStatus) {
        notifType = "TASK_STATUS_CHANGED";
        changes.push(`status changed from '${updates.previousStatus}' to '${updates.status}'`);
      }

      if (updates.assigneeId !== undefined && updates.assigneeId !== updates.previousAssigneeId) {
        notifType = "TASK_ASSIGNED";
        changes.push(
          currentAssignee
            ? `assigned to ${currentAssignee.name}`
            : "unassigned"
        );
      }

      if (updates.images && updates.previousImages && updates.images.length > updates.previousImages.length) {
        const addedCount = updates.images.length - updates.previousImages.length;
        changes.push(`${addedCount} new proof/document attachment(s) uploaded`);
      }

      if (updates.videoUrl && updates.videoUrl !== updates.previousVideoUrl) {
        changes.push("demo video link attached");
      }

      if (updates.title) changes.push("title modified");
      if (updates.description !== undefined) changes.push("description updated");

      const changesSummary = changes.length > 0 ? changes.join(", ") : "task details updated";

      const title = `Task Updated: "${taskTitle}"`;
      const message = `${actorName} updated '${taskTitle}' in '${projectName}': ${changesSummary}.`;

      const emailPayload = getTaskUpdatedEmail({
        projectId,
        projectName,
        taskId,
        taskTitle,
        actorName,
        changesSummary,
        previousStatus: updates.previousStatus,
        newStatus: updates.status,
        newAssigneeName: currentAssignee?.name || null,
        imagesCount: updates.images?.length,
        videoUrl: updates.videoUrl,
      });

      await NotificationService.dispatchNotification({
        recipients,
        title,
        message,
        type: notifType,
        projectId,
        taskId,
        data: { projectId, projectName, taskId, taskTitle, actorId, actorName, changesSummary, updates },
        emailPayload,
      });
    } catch (err) {
      console.error("[NotificationService] notifyTaskUpdated failed:", err);
    }
  }

  /**
   * Trigger 4A: Task Deleted
   * Recipients: Admin(s), ProjectManager(s), and Assignee.
   */
  public static async notifyTaskDeleted(
    projectId: string,
    projectName: string,
    taskId: string,
    taskTitle: string,
    actorId: string,
    assigneeId?: string | null
  ): Promise<void> {
    try {
      const actor = await NotificationService.getUserById(actorId);
      const assignee = await NotificationService.getUserById(assigneeId);
      const pms = await NotificationService.getProjectManagers(projectId);
      const admins = await NotificationService.getAdminUsers();

      const recipients: RecipientUser[] = [];
      if (assignee) recipients.push(assignee);
      for (const pm of pms) recipients.push(pm);
      for (const a of admins) recipients.push(a);

      const actorName = actor?.name || "Team Member";

      const title = `Task Deleted: "${taskTitle}"`;
      const message = `${actorName} deleted task '${taskTitle}' from project '${projectName}'.`;

      const emailPayload = getDeletionEmail({
        itemType: "Task",
        itemName: taskTitle,
        projectName,
        actorName,
      });

      await NotificationService.dispatchNotification({
        recipients,
        title,
        message,
        type: "TASK_DELETED",
        projectId,
        taskId,
        data: { projectId, projectName, taskId, taskTitle, actorId, actorName },
        emailPayload,
      });
    } catch (err) {
      console.error("[NotificationService] notifyTaskDeleted failed:", err);
    }
  }

  /**
   * Trigger 4B: Project Deleted or Archived
   * Recipients: Admin(s), ProjectManager(s), and all Active Workspace Members.
   */
  public static async notifyProjectDeletedOrArchived(
    projectId: string,
    projectName: string,
    actorId: string,
    action: "ARCHIVED" | "DELETED"
  ): Promise<void> {
    try {
      const actor = await NotificationService.getUserById(actorId);
      const project = await Project.findOne({ projectId }).lean();
      const admins = await NotificationService.getAdminUsers();

      const memberIds = new Set<string>();
      if (project?.owner) memberIds.add(project.owner);
      if (project?.members) {
        for (const m of project.members) memberIds.add(m.userId);
      }

      const memberUsers = await User.find({ "uuid.id": { $in: Array.from(memberIds) } }).lean();

      const recipients: RecipientUser[] = [];
      for (const u of memberUsers) {
        recipients.push({
          userId: u.uuid.id,
          email: u.email,
          name: u.name,
          username: u.username,
        });
      }
      for (const a of admins) recipients.push(a);

      const actorName = actor?.name || "Workspace Admin";
      const notifType: NotificationType = action === "ARCHIVED" ? "PROJECT_ARCHIVED" : "PROJECT_DELETED";

      const title = `Project ${action === "ARCHIVED" ? "Archived" : "Deleted"}: "${projectName}"`;
      const message = `Project workspace '${projectName}' was ${action.toLowerCase()} by ${actorName}.`;

      const emailPayload = getDeletionEmail({
        itemType: "Project",
        itemName: projectName,
        actorName,
      });

      await NotificationService.dispatchNotification({
        recipients,
        title,
        message,
        type: notifType,
        projectId,
        data: { projectId, projectName, actorId, actorName, action },
        emailPayload,
      });
    } catch (err) {
      console.error("[NotificationService] notifyProjectDeletedOrArchived failed:", err);
    }
  }

  // ─── User Inbox & Notification Management ──────────────────────────────────

  /**
   * Retrieves paginated inbox notifications for a specific user.
   */
  public static async getUserNotifications(
    userId: string,
    query: GetNotificationsQuery
  ): Promise<PaginatedNotifications> {
    const { page, limit, isRead, type, projectId } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { userId };
    if (isRead !== undefined) filter.isRead = isRead;
    if (type) filter.type = type;
    if (projectId) filter.projectId = projectId;

    const [total, unreadCount, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false }),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      notifications: notifications as unknown as INotification[],
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves total unread notification count for a user.
   */
  public static async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return { unreadCount };
  }

  /**
   * Marks a single notification as read/seen.
   */
  public static async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<INotification> {
    const notification = await Notification.findOneAndUpdate(
      { notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      throw new ApiError(404, "Notification not found or access denied");
    }

    const { unreadCount } = await NotificationService.getUnreadCount(userId);
    emitUserEvent(userId, "notification:read", { notificationId, unreadCount });

    return notification;
  }

  /**
   * Marks all notifications (or all in a project) as read for a user.
   */
  public static async markAllAsRead(
    userId: string,
    projectId?: string
  ): Promise<{ updatedCount: number; unreadCount: number }> {
    const filter: Record<string, any> = { userId, isRead: false };
    if (projectId) filter.projectId = projectId;

    const result = await Notification.updateMany(filter, {
      $set: { isRead: true, readAt: new Date() },
    });

    const { unreadCount } = await NotificationService.getUnreadCount(userId);
    emitUserEvent(userId, "notification:read_all", { updatedCount: result.modifiedCount, unreadCount });

    return { updatedCount: result.modifiedCount, unreadCount };
  }

  /**
   * Deletes a single notification from a user's inbox.
   */
  public static async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    const result = await Notification.deleteOne({ notificationId, userId });
    if (result.deletedCount === 0) {
      throw new ApiError(404, "Notification not found or access denied");
    }

    const { unreadCount } = await NotificationService.getUnreadCount(userId);
    emitUserEvent(userId, "notification:deleted", { notificationId, unreadCount });

    return { success: true };
  }

  /**
   * Clears all notifications for a user (optionally only read ones).
   */
  public static async clearAllNotifications(
    userId: string,
    readOnly: boolean = false
  ): Promise<{ deletedCount: number }> {
    const filter: Record<string, any> = { userId };
    if (readOnly) filter.isRead = true;

    const result = await Notification.deleteMany(filter);
    const { unreadCount } = await NotificationService.getUnreadCount(userId);
    emitUserEvent(userId, "notification:cleared", { deletedCount: result.deletedCount, unreadCount });

    return { deletedCount: result.deletedCount };
  }
}
