import { env } from "../config/env";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  statusCode?: number;
  recipientCount: number;
  error?: string;
}

/**
 * Dispatches an email via the SendGrid v3 API with fail-safe error handling.
 * If SendGrid is not configured in development, logs the email metadata cleanly.
 */
export const sendEmail = async (options: SendEmailOptions): Promise<SendEmailResult> => {
  const recipients = Array.isArray(options.to)
    ? [...new Set(options.to.map((e) => e.trim().toLowerCase()).filter(Boolean))]
    : [options.to.trim().toLowerCase()].filter(Boolean);

  if (recipients.length === 0) {
    return {
      success: false,
      recipientCount: 0,
      error: "No valid recipient email addresses provided",
    };
  }

  const fromEmail = options.fromEmail || env.SENDGRID_FROM_EMAIL || "notifications@teamflow.app";
  const fromName = options.fromName || env.SENDGRID_FROM_NAME || "TeamFlow Notifications";

  // Development / Mock fallback when SendGrid API key is not configured
  if (!env.isSendGridConfigured) {
    console.log(
      `[SendGrid (Dev Mode)] Mock email dispatched to: [${recipients.join(", ")}] | Subject: "${options.subject}"`
    );
    return {
      success: true,
      recipientCount: recipients.length,
      statusCode: 202,
    };
  }

  try {
    const personalizations = recipients.map((email) => ({
      to: [{ email }],
    }));

    const body = {
      personalizations,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: options.subject,
      content: [
        {
          type: "text/plain",
          value: options.text || options.subject,
        },
        {
          type: "text/html",
          value: options.html,
        },
      ],
    };

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SendGrid] Error sending email (Status ${response.status}):`, errorText);
      return {
        success: false,
        statusCode: response.status,
        recipientCount: recipients.length,
        error: errorText,
      };
    }

    console.log(`[SendGrid] Successfully dispatched email to ${recipients.length} recipient(s): "${options.subject}"`);
    return {
      success: true,
      statusCode: response.status,
      recipientCount: recipients.length,
    };
  } catch (error: any) {
    console.error("[SendGrid] Unexpected network error while dispatching email:", error);
    return {
      success: false,
      recipientCount: recipients.length,
      error: error?.message || "Unknown SendGrid dispatch failure",
    };
  }
};
