import { env } from "../config/env";

export interface EmailTemplatePayload {
  subject: string;
  html: string;
  text: string;
}

/**
 * Base email layout wrapper providing unified responsive styling, branding, and footer.
 */
const renderBaseLayout = (options: {
  headline: string;
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  previewText?: string;
}): string => {
  const { headline, badgeText, badgeColor, badgeBg, contentHtml, ctaText, ctaUrl, previewText } = options;
  const appUrl = env.APP_URL || "http://localhost:5173";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0f172a;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #1e293b;
      border-radius: 12px;
      border: 1px solid #334155;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 28px 32px;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border-bottom: 1px solid #3730a3;
      text-align: left;
    }
    .brand-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #a5b4fc;
    }
    .content {
      padding: 32px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .headline {
      margin: 0 0 16px 0;
      font-size: 22px;
      font-weight: 700;
      color: #f8fafc;
      line-height: 1.3;
    }
    .details-box {
      background-color: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .details-row {
      margin-bottom: 12px;
      display: flex;
    }
    .details-row:last-child {
      margin-bottom: 0;
    }
    .details-label {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      width: 140px;
      flex-shrink: 0;
    }
    .details-value {
      font-size: 13px;
      color: #f1f5f9;
      font-weight: 500;
    }
    .cta-container {
      margin: 32px 0 16px 0;
      text-align: center;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .footer {
      padding: 24px 32px;
      background-color: #0f172a;
      border-top: 1px solid #1e293b;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #818cf8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ""}
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand-title">TeamFlow</h1>
        <p class="brand-subtitle">Sprint & Project Management SaaS</p>
      </div>
      <div class="content">
        <div class="badge" style="background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor};">
          ${badgeText}
        </div>
        <h2 class="headline">${headline}</h2>
        ${contentHtml}
        ${
          ctaText && ctaUrl
            ? `
        <div class="cta-container">
          <a href="${ctaUrl}" class="cta-button" target="_blank">${ctaText}</a>
        </div>
        `
            : ""
        }
      </div>
      <div class="footer">
        <p style="margin:0 0 8px 0;">You received this notification from your active project workspace on <a href="${appUrl}">TeamFlow</a>.</p>
        <p style="margin:0;">&copy; ${new Date().getFullYear()} TeamFlow SaaS Inc. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * 1. Project Created Template
 */
export const getProjectCreatedEmail = (data: {
  projectName: string;
  projectId: string;
  creatorName: string;
  creatorEmail: string;
  description?: string;
}): EmailTemplatePayload => {
  const ctaUrl = `${env.APP_URL}/projects/${data.projectId}`;
  const subject = `[TeamFlow] New Project Created: "${data.projectName}"`;

  const contentHtml = `
    <p style="color:#cbd5e1; font-size:15px; line-height:1.6; margin-top:0;">
      A new project workspace <strong>${data.projectName}</strong> has been initialized by <strong>${data.creatorName}</strong> (${data.creatorEmail}).
    </p>
    <div class="details-box">
      <div class="details-row">
        <span class="details-label">Project Name:</span>
        <span class="details-value">${data.projectName}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Workspace ID:</span>
        <span class="details-value"><code>${data.projectId}</code></span>
      </div>
      <div class="details-row">
        <span class="details-label">Project Manager:</span>
        <span class="details-value">${data.creatorName} (${data.creatorEmail})</span>
      </div>
      ${
        data.description
          ? `
      <div class="details-row">
        <span class="details-label">Description:</span>
        <span class="details-value">${data.description}</span>
      </div>
      `
          : ""
      }
    </div>
  `;

  const html = renderBaseLayout({
    headline: `Project "${data.projectName}" Created`,
    badgeText: "Workspace Initialized",
    badgeColor: "#818cf8",
    badgeBg: "rgba(99, 102, 241, 0.15)",
    contentHtml,
    ctaText: "Open Project Board",
    ctaUrl,
    previewText: `New project workspace ${data.projectName} initialized by ${data.creatorName}.`,
  });

  const text = `TeamFlow Notification: Project Created\n\nProject "${data.projectName}" was created by ${data.creatorName} (${data.creatorEmail}).\nView Project: ${ctaUrl}`;

  return { subject, html, text };
};

/**
 * 2. Member Invited / Added Template
 */
export const getMemberInvitedEmail = (data: {
  projectName: string;
  projectId: string;
  memberName: string;
  memberEmail: string;
  role: string;
  inviterName: string;
}): EmailTemplatePayload => {
  const ctaUrl = `${env.APP_URL}/projects/${data.projectId}`;
  const subject = `[TeamFlow] You've been invited to project: "${data.projectName}"`;

  const contentHtml = `
    <p style="color:#cbd5e1; font-size:15px; line-height:1.6; margin-top:0;">
      <strong>${data.inviterName}</strong> added <strong>${data.memberName}</strong> (${data.memberEmail}) to the workspace as a <strong>${data.role}</strong>.
    </p>
    <div class="details-box">
      <div class="details-row">
        <span class="details-label">Project Workspace:</span>
        <span class="details-value">${data.projectName}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Assigned Role:</span>
        <span class="details-value">${data.role}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Invited Member:</span>
        <span class="details-value">${data.memberName} (${data.memberEmail})</span>
      </div>
      <div class="details-row">
        <span class="details-label">Invited By:</span>
        <span class="details-value">${data.inviterName}</span>
      </div>
    </div>
  `;

  const html = renderBaseLayout({
    headline: `Team Member Added to "${data.projectName}"`,
    badgeText: "Member Invited",
    badgeColor: "#38bdf8",
    badgeBg: "rgba(14, 165, 233, 0.15)",
    contentHtml,
    ctaText: "Access Project Workspace",
    ctaUrl,
    previewText: `You have been added to ${data.projectName} as a ${data.role}.`,
  });

  const text = `TeamFlow Notification: Member Invited\n\n${data.memberName} has been added to "${data.projectName}" as ${data.role} by ${data.inviterName}.\nAccess Workspace: ${ctaUrl}`;

  return { subject, html, text };
};

/**
 * 3. Member Removed Template
 */
export const getMemberRemovedEmail = (data: {
  projectName: string;
  projectId: string;
  memberName: string;
  memberEmail: string;
  actorName: string;
}): EmailTemplatePayload => {
  const subject = `[TeamFlow] Member Removed from "${data.projectName}"`;

  const contentHtml = `
    <p style="color:#cbd5e1; font-size:15px; line-height:1.6; margin-top:0;">
      <strong>${data.memberName}</strong> (${data.memberEmail}) was removed from the project workspace <strong>${data.projectName}</strong> by <strong>${data.actorName}</strong>.
    </p>
    <div class="details-box">
      <div class="details-row">
        <span class="details-label">Project Workspace:</span>
        <span class="details-value">${data.projectName}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Removed Member:</span>
        <span class="details-value">${data.memberName} (${data.memberEmail})</span>
      </div>
      <div class="details-row">
        <span class="details-label">Action Performed By:</span>
        <span class="details-value">${data.actorName}</span>
      </div>
    </div>
  `;

  const html = renderBaseLayout({
    headline: `Member Removed from "${data.projectName}"`,
    badgeText: "Member Removed",
    badgeColor: "#fbbf24",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    contentHtml,
    previewText: `${data.memberName} was removed from ${data.projectName}.`,
  });

  const text = `TeamFlow Notification: Member Removed\n\n${data.memberName} was removed from "${data.projectName}" by ${data.actorName}.`;

  return { subject, html, text };
};

/**
 * 4. Task Created Template
 */
export const getTaskCreatedEmail = (data: {
  projectName: string;
  projectId: string;
  taskTitle: string;
  taskId: string;
  creatorName: string;
  assigneeName?: string | null;
  status: string;
  imagesCount?: number;
  hasVideo?: boolean;
}): EmailTemplatePayload => {
  const ctaUrl = `${env.APP_URL}/projects/${data.projectId}?task=${data.taskId}`;
  const subject = `[TeamFlow] New Task: "${data.taskTitle}" in "${data.projectName}"`;

  const contentHtml = `
    <p style="color:#cbd5e1; font-size:15px; line-height:1.6; margin-top:0;">
      A new task <strong>"${data.taskTitle}"</strong> has been created in <strong>${data.projectName}</strong> by <strong>${data.creatorName}</strong>.
    </p>
    <div class="details-box">
      <div class="details-row">
        <span class="details-label">Task Title:</span>
        <span class="details-value">${data.taskTitle}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Initial Status:</span>
        <span class="details-value">${data.status.toUpperCase()}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Assignee:</span>
        <span class="details-value">${data.assigneeName || "Unassigned"}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Created By:</span>
        <span class="details-value">${data.creatorName}</span>
      </div>
      ${
        data.imagesCount
          ? `
      <div class="details-row">
        <span class="details-label">Attachments:</span>
        <span class="details-value">${data.imagesCount} file(s) attached</span>
      </div>
      `
          : ""
      }
      ${
        data.hasVideo
          ? `
      <div class="details-row">
        <span class="details-label">Video Demo:</span>
        <span class="details-value">Video walkthrough link attached</span>
      </div>
      `
          : ""
      }
    </div>
  `;

  const html = renderBaseLayout({
    headline: `New Task Created: "${data.taskTitle}"`,
    badgeText: "Task Created",
    badgeColor: "#60a5fa",
    badgeBg: "rgba(59, 130, 246, 0.15)",
    contentHtml,
    ctaText: "View Task Details",
    ctaUrl,
    previewText: `New task "${data.taskTitle}" created in ${data.projectName}.`,
  });

  const text = `TeamFlow Notification: Task Created\n\nTask "${data.taskTitle}" was created in "${data.projectName}" by ${data.creatorName}.\nStatus: ${data.status}\nAssignee: ${data.assigneeName || "Unassigned"}\nView Task: ${ctaUrl}`;

  return { subject, html, text };
};

/**
 * 5. Task Updated / Status Changed / Media Added Template
 */
export const getTaskUpdatedEmail = (data: {
  projectName: string;
  projectId: string;
  taskTitle: string;
  taskId: string;
  actorName: string;
  changesSummary: string;
  previousStatus?: string;
  newStatus?: string;
  newAssigneeName?: string | null;
  imagesCount?: number;
  videoUrl?: string | null;
}): EmailTemplatePayload => {
  const ctaUrl = `${env.APP_URL}/projects/${data.projectId}?task=${data.taskId}`;
  const isDone = data.newStatus === "done";
  const subject = `[TeamFlow] Task Updated: "${data.taskTitle}" (${data.changesSummary})`;

  const contentHtml = `
    <p style="color:#cbd5e1; font-size:15px; line-height:1.6; margin-top:0;">
      <strong>${data.actorName}</strong> updated task <strong>"${data.taskTitle}"</strong> in workspace <strong>${data.projectName}</strong>.
    </p>
    <div class="details-box">
      <div class="details-row">
        <span class="details-label">Task:</span>
        <span class="details-value">${data.taskTitle}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Action / Update:</span>
        <span class="details-value" style="color:#38bdf8;">${data.changesSummary}</span>
      </div>
      ${
        data.previousStatus && data.newStatus
          ? `
      <div class="details-row">
        <span class="details-label">Status Transition:</span>
        <span class="details-value"><code>${data.previousStatus}</code> &rarr; <strong style="color:${isDone ? "#4ade80" : "#f59e0b"};">${data.newStatus.toUpperCase()}</strong></span>
      </div>
      `
          : ""
      }
      ${
        data.newAssigneeName !== undefined
          ? `
      <div class="details-row">
        <span class="details-label">Assignee:</span>
        <span class="details-value">${data.newAssigneeName || "Unassigned"}</span>
      </div>
      `
          : ""
      }
      ${
        data.imagesCount
          ? `
      <div class="details-row">
        <span class="details-label">Proof / Files:</span>
        <span class="details-value">${data.imagesCount} file(s) attached</span>
      </div>
      `
          : ""
      }
      ${
        data.videoUrl
          ? `
      <div class="details-row">
        <span class="details-label">Video Walkthrough:</span>
        <span class="details-value"><a href="${data.videoUrl}" style="color:#818cf8;">Watch Video Demo</a></span>
      </div>
      `
          : ""
      }
      <div class="details-row">
        <span class="details-label">Updated By:</span>
        <span class="details-value">${data.actorName}</span>
      </div>
    </div>
  `;

  const badgeColor = isDone ? "#4ade80" : "#c084fc";
  const badgeBg = isDone ? "rgba(74, 222, 128, 0.15)" : "rgba(192, 132, 252, 0.15)";
  const badgeText = isDone ? "Task Completed (Done)" : "Task Updated";

  const html = renderBaseLayout({
    headline: `Task Updated: "${data.taskTitle}"`,
    badgeText,
    badgeColor,
    badgeBg,
    contentHtml,
    ctaText: "View Updated Task",
    ctaUrl,
    previewText: `Task "${data.taskTitle}" updated by ${data.actorName}: ${data.changesSummary}.`,
  });

  const text = `TeamFlow Notification: Task Updated\n\nTask "${data.taskTitle}" in "${data.projectName}" was updated by ${data.actorName}.\nSummary: ${data.changesSummary}\nView Task: ${ctaUrl}`;

  return { subject, html, text };
};

/**
 * 6. Task / Project Deleted Template
 */
export const getDeletionEmail = (data: {
  itemType: "Project" | "Task";
  itemName: string;
  projectName?: string;
  actorName: string;
}): EmailTemplatePayload => {
  const subject = `[TeamFlow] ${data.itemType} Deleted: "${data.itemName}"`;

  const contentHtml = `
    <p style="color:#cbd5e1; font-size:15px; line-height:1.6; margin-top:0;">
      The ${data.itemType.toLowerCase()} <strong>"${data.itemName}"</strong> ${data.projectName ? `in workspace <strong>${data.projectName}</strong>` : ""} has been deleted by <strong>${data.actorName}</strong>.
    </p>
    <div class="details-box">
      <div class="details-row">
        <span class="details-label">${data.itemType} Name:</span>
        <span class="details-value">${data.itemName}</span>
      </div>
      ${
        data.projectName
          ? `
      <div class="details-row">
        <span class="details-label">Project Workspace:</span>
        <span class="details-value">${data.projectName}</span>
      </div>
      `
          : ""
      }
      <div class="details-row">
        <span class="details-label">Deleted By:</span>
        <span class="details-value">${data.actorName}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Timestamp:</span>
        <span class="details-value">${new Date().toUTCString()}</span>
      </div>
    </div>
  `;

  const html = renderBaseLayout({
    headline: `${data.itemType} "${data.itemName}" Deleted`,
    badgeText: `${data.itemType} Deleted`,
    badgeColor: "#f87171",
    badgeBg: "rgba(248, 113, 113, 0.15)",
    contentHtml,
    previewText: `${data.itemType} "${data.itemName}" has been deleted by ${data.actorName}.`,
  });

  const text = `TeamFlow Notification: ${data.itemType} Deleted\n\n${data.itemType} "${data.itemName}" was deleted by ${data.actorName}.`;

  return { subject, html, text };
};
