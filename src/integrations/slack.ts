import { createLogger } from "@/lib/logger";
import type { Alert, Repository } from "@/server/db/schema";

const log = createLogger({ module: "slack" });

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text?: string | { type: string; text: string }; url?: string }>;
}

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

export async function sendSlackAlert(
  alert: Alert,
  repo: Repository
): Promise<void> {
  if (!WEBHOOK_URL) {
    log.warn("SLACK_WEBHOOK_URL not configured, skipping notification");
    return;
  }

  const emoji = SEVERITY_EMOJI[alert.severity] || "📢";
  const color = SEVERITY_COLOR[alert.severity] || "#6b7280";

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} Sentinel Alert`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${alert.title}*\n\n${alert.message}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Repository:* ${repo.owner}/${repo.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Severity:* ${alert.severity.toUpperCase()}`,
        },
        {
          type: "mrkdwn",
          text: `*Rule:* ${alert.ruleName}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Dashboard",
          },
          url: `${DASHBOARD_URL}/dashboard`,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Alerts",
          },
          url: `${DASHBOARD_URL}/dashboard/alerts`,
        },
      ],
    },
  ];

  const payload = {
    attachments: [
      {
        color,
        blocks,
      },
    ],
  };

  log.debug({ alertId: alert.id, repo: `${repo.owner}/${repo.name}` }, "sending Slack notification");

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack API error: ${response.status} ${text}`);
  }

  log.info({ alertId: alert.id }, "Slack notification sent");
}
