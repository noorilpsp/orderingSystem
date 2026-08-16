/**
 * Email utility for sending transactional emails
 * Supports multiple providers (Brevo, Resend, SendGrid, or custom SMTP)
 */

type EmailOptions = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

type EmailResult = {
  success: boolean;
  error?: string;
  messageId?: string;
};

/**
 * Send an email using the configured email provider
 * Falls back to console logging in development if no provider is configured
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, html, from } = options;
  let lastError: string | undefined;

  // Try Brevo first (formerly Sendinblue). On 401/other failure, continue to Resend.
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    try {
      const brevo = await import("@getbrevo/brevo").catch(() => null);
      if (brevo) {
        const apiInstance = new brevo.TransactionalEmailsApi();

        apiInstance.setApiKey(
          brevo.TransactionalEmailsApiApiKeys.apiKey,
          brevoKey,
        );

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;

        const senderEmail = from || process.env.BREVO_FROM_EMAIL?.trim();
        if (senderEmail) {
          sendSmtpEmail.sender = {
            name: process.env.BREVO_SENDER_NAME?.split("#")[0]?.trim() || "BerryTap",
            email: senderEmail,
          };
          sendSmtpEmail.to = [{ email: to }];

          const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
          return { success: true, messageId: result.body?.messageId || "sent" };
        }
        lastError = "BREVO_FROM_EMAIL not set";
        console.warn("[email]", lastError, "— trying next provider");
      }
    } catch (err: any) {
      console.error("[email] Brevo error:", err);
      lastError =
        err.response?.status === 401
          ? "Brevo authentication failed (401). API key is present but rejected."
          : err.response?.body?.message || err.message || "Brevo send failed";
      console.warn("[email] Falling through to next provider:", lastError);
    }
  }

  // Try Resend (recommended for Vercel deployments)
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const resend = await import("resend").catch(() => null);
      if (resend) {
        const { Resend } = resend;
        const resendClient = new Resend(resendKey);

        const { data, error } = await resendClient.emails.send({
          from: from || process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev",
          to,
          subject,
          html,
        });

        if (error) {
          console.error("[email] Resend error:", error);
          return { success: false, error: error.message };
        }

        return { success: true, messageId: data?.id };
      }
    } catch (err) {
      console.error("[email] Resend import/send error:", err);
    }
  }

  // Try SendGrid if configured (only if package is installed)
  // Note: This is optional - package doesn't need to be installed
  // Skip SendGrid entirely to avoid build warnings if package not installed
  // Uncomment and install @sendgrid/mail if you want to use SendGrid
  /*
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMailModule = await import("@sendgrid/mail").catch(() => null);
      
      if (sgMailModule?.default) {
        sgMailModule.default.setApiKey(process.env.SENDGRID_API_KEY);

        const msg = {
          to,
          from: from || process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
          subject,
          html,
        };

        await sgMailModule.default.send(msg);
        return { success: true };
      }
    } catch (err: any) {
      console.error("[email] SendGrid error:", err);
      return { success: false, error: err.message };
    }
  }
  */

  // Fallback: Log in development, warn in production
  if (process.env.NODE_ENV === "development") {
    console.log("[email] No email provider configured. Email would be sent:");
    console.log("  To:", to);
    console.log("  Subject:", subject);
    console.log("  HTML:", html.substring(0, 100) + "...");
    return { success: true, messageId: "dev-mode-logged" };
  }

  // Production fallback: return error if no provider configured
  console.warn("[email] No email provider configured. Email not sent.");
  return {
    success: false,
    error: "No email provider configured. Set BREVO_API_KEY, RESEND_API_KEY, or SENDGRID_API_KEY",
  };
}

/**
 * Send a merchant invitation email
 */
export async function sendInvitationEmail(
  email: string,
  invitationToken: string,
  merchantName: string,
  role: string,
): Promise<EmailResult> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    .split("#")[0]
    .trim()
    .replace(/\/$/, "");
  const invitationUrl = `${siteUrl}/invite/${invitationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've been invited to join ${merchantName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">You've been invited!</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            You've been invited to join <strong>${merchantName}</strong> as a <strong>${role}</strong>.
          </p>
          
          <p style="font-size: 16px; margin-bottom: 30px;">
            Click the button below to accept your invitation and create your account:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            Or copy and paste this link into your browser:<br>
            <a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
          </p>
          
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
            This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `You've been invited to join ${merchantName}`,
    html,
  });
}

