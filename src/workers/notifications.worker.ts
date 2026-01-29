import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alerts, repositories } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import { sendSlackAlert } from "@/integrations/slack";
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

  for (const channel of channels) {
    try {
      switch (channel) {
        case "slack":
          await sendSlackAlert(alert, repo);
          break;
        case "email":
          jobLog.debug("email channel not implemented");
          break;
        case "pagerduty":
          jobLog.debug("pagerduty channel not implemented");
          break;
        default:
          jobLog.warn({ channel }, "unknown notification channel");
      }
    } catch (err) {
      jobLog.error({ channel, err: (err as Error).message }, "notification failed");
      throw err;
    }
  }

  await db
    .update(alerts)
    .set({ sentAt: new Date() })
    .where(eq(alerts.id, alertId));

  jobLog.info({ channels }, "notification sent");
}
