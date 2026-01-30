import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alerts, repositories } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import { sendSlackAlert } from "@/integrations/slack";
import { sendEmailAlert } from "@/integrations/email";
import { sendPagerDutyAlert } from "@/integrations/pagerduty";
import type { NotificationJobData } from "@/lib/queue";

const log = createLogger({ module: "notification-worker" });

export async function processNotification(job: Job<NotificationJobData>) {
  const { alertId } = job.data;
  const jobLog = log.child({ alertId, jobId: job.id });

  jobLog.info("processing notification");

  const alert = await db.query.alerts.findFirst({
    where: eq(alerts.id, alertId),
  });

  if (!alert) {
    jobLog.warn("alert not found");
    return;
  }

  if (alert.sentAt) {
    jobLog.debug("notification already sent");
    return;
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, alert.repoId),
  });

  if (!repo) {
    jobLog.warn("repository not found");
    return;
  }

  const channels = alert.channels as string[];
  const errors: string[] = [];
  const sent: string[] = [];

  for (const channel of channels) {
    try {
      switch (channel) {
        case "slack":
          await sendSlackAlert(alert, repo);
          sent.push("slack");
          break;
        case "email":
          await sendEmailAlert(alert, repo);
          sent.push("email");
          break;
        case "pagerduty":
          await sendPagerDutyAlert(alert, repo);
          sent.push("pagerduty");
          break;
        default:
          jobLog.warn({ channel }, "unknown notification channel");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      jobLog.error({ channel, error: message }, "notification failed");
      errors.push(`${channel}: ${message}`);
    }
  }

  await db
    .update(alerts)
    .set({ sentAt: new Date() })
    .where(eq(alerts.id, alertId));

  jobLog.info({ sent, failed: errors.length }, "notification processing complete");

  if (errors.length > 0 && sent.length === 0) {
    throw new Error(`All channels failed: ${errors.join("; ")}`);
  }

  if (errors.length > 0) {
    jobLog.warn({ errors }, "partial notification failure");
  }
}
