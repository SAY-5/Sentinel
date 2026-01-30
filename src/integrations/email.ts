import { createLogger } from "@/lib/logger";
import type { Alert, Repository } from "@/server/db/schema";

const log = createLogger({ module: "email" });

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🚨",
  warning: "⚠️",
  info: "ℹ️",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",
};

export async function sendEmailAlert(
  alert: Alert,
  repo: Repository
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn("RESEND_API_KEY not configured, skipping email");
    return;
  }

  const toEmail = process.env.ALERT_EMAIL_TO;
  if (!toEmail) {
    log.warn("ALERT_EMAIL_TO not configured, skipping email");
    return;
  }

  const fromEmail = process.env.ALERT_EMAIL_FROM || "Sentinel <alerts@sentinel.dev>";
  const emoji = SEVERITY_EMOJI[alert.severity] || "📢";
  const color = SEVERITY_COLOR[alert.severity] || "#6b7280";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #18181b; color: #fafafa; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #27272a; border-radius: 8px; border: 1px solid #3f3f46; overflow: hidden;">
    <div style="background: ${color}; padding: 16px 24px;">
      <h1 style="margin: 0; font-size: 18px; color: white;">${emoji} Sentinel Alert</h1>
    </div>
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #fafafa;">${alert.title}</h2>
      <p style="margin: 0 0 24px 0; color: #a1a1aa; line-height: 1.6; white-space: pre-line;">${alert.message}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #71717a; border-bottom: 1px solid #3f3f46;">Repository</td>
          <td style="padding: 8px 0; color: #fafafa; border-bottom: 1px solid #3f3f46; text-align: right;">${repo.owner}/${repo.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a; border-bottom: 1px solid #3f3f46;">Severity</td>
          <td style="padding: 8px 0; color: #fafafa; border-bottom: 1px solid #3f3f46; text-align: right; text-transform: uppercase;">${alert.severity}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a; border-bottom: 1px solid #3f3f46;">Rule</td>
          <td style="padding: 8px 0; color: #fafafa; border-bottom: 1px solid #3f3f46; text-align: right; font-family: monospace;">${alert.ruleName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Triggered</td>
          <td style="padding: 8px 0; color: #fafafa; text-align: right;">${alert.triggeredAt.toISOString()}</td>
        </tr>
      </table>
      
      <a href="${DASHBOARD_URL}/dashboard/alerts" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">View Dashboard</a>
    </div>
    <div style="padding: 16px 24px; background: #18181b; border-top: 1px solid #3f3f46;">
      <p style="margin: 0; font-size: 12px; color: #71717a;">Sent by Sentinel AI Code Safety Platform</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  log.debug({ alertId: alert.id, to: toEmail }, "sending email alert");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject: `${emoji} ${alert.title}`,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API error: ${response.status} ${text}`);
  }

  log.info({ alertId: alert.id }, "email alert sent");
}
