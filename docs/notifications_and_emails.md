# In-App & Email Notification Architecture (SendGrid + Socket.IO + Inbox API)

## 1. Overview & Architecture

TeamFlow includes a production-grade multi-channel notification engine that dispatches both **in-app real-time notifications** and **responsive HTML emails (via SendGrid)** across critical agile workspace lifecycle events.

The system is designed with strict separation of concerns:
- **Zero-Block Async Dispatch**: Email and Socket.IO emissions execute in a non-blocking asynchronous flow so user API response times remain instantaneous and failure-resilient.
- **Fail-Safe Fallback**: If SendGrid is not configured or in development mode, emails are cleanly logged without crashing or stalling API requests.
- **Personal Real-Time Rooms**: Each authenticated user automatically joins their private Socket.IO room `user:${userId}` on connection, enabling targeted instant message delivery.
- **Persistent Inbox Storage**: In-app notifications are stored in MongoDB with indexed read tracking (`isRead`, `readAt`, `metadata`) for high-performance inbox queries.
- **BullMQ Ready**: The notification service dispatcher is abstracted into distinct payload builders and triggers, ready for plug-and-play worker queue dispatching (BullMQ / Redis Streams).

---

## 2. Notification Triggers & Recipient Matrix

| Event Type | Trigger Condition | In-App Recipients | Email Recipients | Payload / Template |
| :--- | :--- | :--- | :--- | :--- |
| `PROJECT_CREATED` | New project is generated | Global Admins + Project Manager (creator) | Global Admins + Project Manager | `getProjectCreatedEmail` (Key, Target Date, Workspace CTA) |
| `MEMBER_INVITED` | User added to project | Global Admins + Project Manager + Invited User | Global Admins + Project Manager + Invited User | `getMemberInvitedEmail` (Role, Project Name, Project CTA) |
| `MEMBER_REMOVED` | User removed from project | Global Admins + Project Manager + Evicted User | Global Admins + Project Manager + Evicted User | `getMemberRemovedEmail` (Project Name, Role Details) |
| `TASK_CREATED` | New task created in project | Global Admins + Project Manager + Assignee (if assigned) | Global Admins + Project Manager + Assignee | `getTaskCreatedEmail` (Task Key, Priority, Due Date, View Task CTA) |
| `TASK_UPDATED` | Task details updated (Status, Priority, Due Date) | Global Admins + Project Manager + Assignee | Global Admins + Project Manager + Assignee | `getTaskUpdatedEmail` (Diff metadata of changes) |
| `TASK_ATTACHMENT_ADDED` | Images / PDFs / attachments uploaded to task | Global Admins + Project Manager + Assignee | Global Admins + Project Manager + Assignee | `getTaskUpdatedEmail` (Attachment count & thumbnail indicators) |
| `TASK_VIDEO_ADDED` | Video demonstration URL added to task | Global Admins + Project Manager + Assignee | Global Admins + Project Manager + Assignee | `getTaskUpdatedEmail` (Embedded video URL reference) |
| `TASK_DELETED` | Task deleted from project | Global Admins + Project Manager + Assignee | Global Admins + Project Manager + Assignee | `getDeletionEmail` (Resource Name, Deletion Timestamp) |
| `PROJECT_DELETED` | Project deleted or archived | Global Admins + Project Manager + All Project Members | Global Admins + Project Manager + All Project Members | `getDeletionEmail` (Project Key, Name, Archive status) |

> **Note on Deduplication**: The recipient resolver dynamically aggregates and deduplicates IDs so users never receive duplicate notifications even if they match multiple roles (e.g. if the Project Manager is also the Task Assignee).

---

## 3. SendGrid Email Engine

### Configuration & Environment Variables

Add the following keys to your `.env` configuration:

```env
# SendGrid API & Email Configuration
SENDGRID_API_KEY=SG.your_actual_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=notifications@teamflow.internal
SENDGRID_FROM_NAME=TeamFlow Sprint Manager

# Global Administrator Notification Broadcast List (comma-separated)
ADMIN_EMAILS=admin@teamflow.internal,lead@teamflow.internal

# Frontend Application Base URL (used in email CTA action buttons)
APP_URL=http://localhost:3000
```

### Direct SendGrid v3 REST Integration

The dispatcher uses native `fetch` against `https://api.sendgrid.com/v3/mail/send` with strict MIME formatting (`text/html` and plain `text/plain`). If `SENDGRID_API_KEY` is omitted in development, a simulated mock dispatcher logs the outgoing payload to the console without interrupting application execution.

---

## 4. In-App Notification Inbox APIs

All notification endpoints require authentication via standard `Authorization: Bearer <accessToken>`.

### 1. List User Notifications (Paginated)
- **Endpoint**: `GET /api/v1/notifications`
- **Query Parameters**:
  - `page` *(number, default: 1)*: Page number.
  - `limit` *(number, default: 20, max: 100)*: Items per page.
  - `isRead` *(boolean, optional)*: Filter by `true` (seen) or `false` (unseen/unread).
  - `type` *(string, optional)*: Filter by `NotificationType`.
  - `projectId` *(string, optional)*: Filter by associated project.
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "_id": "6640f8a9e4b0c12a89d45e10",
        "userId": "6640f8a9e4b0c12a89d45e01",
        "type": "TASK_CREATED",
        "title": "New Task Created: Implement Auth Flow",
        "message": "Task 'Implement Auth Flow' (PROJ-42) has been created and assigned to you.",
        "projectId": "6640f8a9e4b0c12a89d45e02",
        "taskId": "6640f8a9e4b0c12a89d45e03",
        "isRead": false,
        "readAt": null,
        "metadata": {
          "taskTitle": "Implement Auth Flow",
          "taskKey": "PROJ-42",
          "priority": "HIGH"
        },
        "createdAt": "2026-09-26T17:00:00.000Z",
        "updatedAt": "2026-09-26T17:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "unreadCount": 12
  }
}
```

### 2. Get Unread Notification Count
- **Endpoint**: `GET /api/v1/notifications/unread-count`
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Unread count retrieved successfully",
  "data": {
    "unreadCount": 12
  }
}
```

### 3. Mark Single Notification as Read
- **Endpoint**: `PATCH /api/v1/notifications/:id/read`
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "6640f8a9e4b0c12a89d45e10",
      "isRead": true,
      "readAt": "2026-09-26T17:05:00.000Z"
    }
  }
}
```

### 4. Mark All Notifications as Read
- **Endpoint**: `PATCH /api/v1/notifications/read-all`
- **Query Parameters**:
  - `projectId` *(optional string)*: Limit marking as read to a specific project.
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 12
  }
}
```

### 5. Delete Single Notification
- **Endpoint**: `DELETE /api/v1/notifications/:id`
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification deleted successfully",
  "data": {
    "id": "6640f8a9e4b0c12a89d45e10"
  }
}
```

### 6. Clear All Notifications
- **Endpoint**: `DELETE /api/v1/notifications/clear-all`
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "All notifications cleared",
  "data": {
    "deletedCount": 45
  }
}
```

### 7. Send Test Email (Admins / Developers)
- **Endpoint**: `POST /api/v1/notifications/test-email`
- **Body**:
```json
{
  "to": "dev@company.com",
  "subject": "TeamFlow SendGrid Verification",
  "message": "Testing real-time SendGrid integration."
}
```

---

## 5. Real-Time Socket.IO Channels

Clients subscribing to Socket.IO can listen for real-time notification events in addition to existing project rooms:

| Socket Event | Payload | Description |
| :--- | :--- | :--- |
| `notification:new` | Full `INotification` document | Emitted to `user:${userId}` room when a new notification is generated. |
| `notification:read` | `{ notificationId, readAt }` | Emitted when a notification is marked as read. |
| `notification:read_all` | `{ modifiedCount }` | Emitted when all notifications are marked as read. |
| `notification:deleted` | `{ notificationId }` | Emitted when a notification is deleted. |
| `notification:cleared` | `{}` | Emitted when inbox is cleared. |

---

## 6. Asynchronous Scalability & BullMQ Roadmap

The current architecture is structured for seamless scaling:
1. **Service Decoupling**: All triggers generate standard payloads (`NotificationPayload`) that encapsulate the title, message, HTML email template, and recipient metadata.
2. **Pluggable Workers**: When migrating to BullMQ or AWS SQS:
   - Replace the direct `dispatchNotification(...)` call inside `NotificationService` with `notificationQueue.add("send-notification", payload)`.
   - The worker process picks up the job and executes `sendEmail(...)` and `Notification.create(...)`.
   - Redis concurrency controls prevent SendGrid rate-limit spikes.
