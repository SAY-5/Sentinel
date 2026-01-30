import { createLogger } from "@/lib/logger";
import type { Alert, Repository } from "@/server/db/schema";

const log = createLogger({ module: "pagerduty" });

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SEVERITY_MAP: Record<string, string> = {
  critical: "critical",
  warning: "warning",
  info: "info",
};

export async function sendPagerDutyAlert(
  alert: Alert,
  repo: Repository
): Promise<void> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) {
    log.warn("PAGERDUTY_ROUTING_KEY not configured, skipping");
    return;
  }

  const dedupKey = `sentinel-${alert.ruleName}-${repo.id}`;
  const severity = SEVERITY_MAP[alert.severity] || "info";

  log.debug({ alertId: alert.id, dedupKey }, "sending PagerDuty alert");

  const response = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_key: routingKey,
      event_action: "trigger",
      dedup_key: dedupKey,
      payload: {
        summary: `[${repo.owner}/${repo.name}] ${alert.title}`,
        severity,
        source: `sentinel-${repo.owner}-${repo.name}`,
        timestamp: alert.triggeredAt.toISOString(),
        custom_details: {
          message: alert.message,
          rule: alert.ruleName,
          metric_value: alert.metricValue,
          threshold: alert.threshold,
          repository: `${repo.owner}/${repo.name}`,
          dashboard_url: `${DASHBOARD_URL}/dashboard/alerts`,
        },
      },
      links: [
        {
          href: `${DASHBOARD_URL}/dashboard/alerts`,
          text: "View in Sentinel Dashboard",
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PagerDuty API error: ${response.status} ${text}`);
  }

  const result = await response.json();
  log.info({ alertId: alert.id, dedupKey, status: result.status }, "PagerDuty alert sent");
}
