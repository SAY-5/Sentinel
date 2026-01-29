import { eq, and, gte, desc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alerts, repositories, repoMetrics } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import { METRICS_RULES } from "./rules";
import type { EvaluationContext, CreatedAlert, AlertTrigger, AlertRule } from "./types";
import { notificationQueue } from "@/lib/queue";

const log = createLogger({ module: "alert-evaluator" });

const DEDUP_WINDOW_HOURS = 24;

export async function evaluateAlertsForRepo(
  repoId: string,
  saturationData?: { saturation: number; activeReviewers: number }
): Promise<CreatedAlert[]> {
  const evalLog = log.child({ repoId });
  evalLog.info("evaluating alerts");

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, repoId),
  });

  if (!repo) {
    evalLog.warn("repository not found");
    return [];
  }

  const [currentMetrics] = await db
    .select()
    .from(repoMetrics)
    .where(and(eq(repoMetrics.repoId, repoId), eq(repoMetrics.period, "day")))
    .orderBy(desc(repoMetrics.date))
    .limit(1);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const prevDateStr = sevenDaysAgo.toISOString().split("T")[0];

  const [previousMetrics] = await db
    .select()
    .from(repoMetrics)
    .where(
      and(
        eq(repoMetrics.repoId, repoId),
        eq(repoMetrics.period, "day"),
        eq(repoMetrics.date, prevDateStr)
      )
    )
    .limit(1);

  const ctx: EvaluationContext = {
    repo,
    currentMetrics: currentMetrics ?? null,
    previousMetrics: previousMetrics ?? null,
    saturationData,
  };

  const createdAlerts: CreatedAlert[] = [];

  for (const rule of METRICS_RULES) {
    const trigger = rule.evaluate(ctx);

    if (!trigger) continue;

    const shouldCreate = await checkDeduplication(repoId, rule.name);

    if (!shouldCreate) {
      evalLog.debug({ rule: rule.name }, "skipped (deduplicated)");
      continue;
    }

    const alert = await createAlert(repoId, rule, trigger);
    createdAlerts.push(alert);

    evalLog.info(
      {
        rule: rule.name,
        severity: rule.severity,
        value: trigger.metricValue,
        threshold: trigger.threshold,
      },
      "alert triggered"
    );

    await enqueueNotification(alert.id);
  }

  evalLog.info({ triggered: createdAlerts.length }, "evaluation complete");

  return createdAlerts;
}

async function checkDeduplication(
  repoId: string,
  ruleName: string
): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - DEDUP_WINDOW_HOURS);

  const recent = await db.query.alerts.findFirst({
    where: and(
      eq(alerts.repoId, repoId),
      eq(alerts.ruleName, ruleName),
      gte(alerts.triggeredAt, windowStart)
    ),
  });

  return !recent;
}

async function createAlert(
  repoId: string,
  rule: AlertRule,
  trigger: AlertTrigger
): Promise<CreatedAlert> {
  const [created] = await db
    .insert(alerts)
    .values({
      repoId,
      ruleName: rule.name,
      severity: rule.severity,
      title: trigger.title,
      message: trigger.message,
      metricValue: trigger.metricValue.toFixed(2),
      threshold: trigger.threshold.toFixed(2),
      channels: rule.channels,
      metadata: trigger.metadata ?? {},
    })
    .returning();

  return {
    id: created.id,
    repoId: created.repoId,
    ruleName: created.ruleName,
    severity: created.severity,
    title: created.title,
    message: created.message,
    channels: rule.channels,
  };
}

async function enqueueNotification(alertId: string): Promise<void> {
  await notificationQueue.add(
    "send-notification",
    { alertId },
    { jobId: `notify-${alertId}` }
  );
}

export async function triggerHighRiskDeployAlert(
  repoId: string,
  files: string[],
  commitSha: string
): Promise<CreatedAlert | null> {
  const shouldCreate = await checkDeduplication(repoId, "high_risk_deployed");
  if (!shouldCreate) return null;

  const trigger: AlertTrigger = {
    title: "High-Risk AI Code Deployed",
    message: `🔥 High-risk AI code deployed to production.\n\nFiles: ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` (+${files.length - 3} more)` : ""}\n\nCommit: ${commitSha.slice(0, 7)}`,
    metricValue: files.length,
    threshold: 1,
    metadata: { files, commitSha },
  };

  const rule = {
    name: "high_risk_deployed",
    severity: "critical" as const,
    channels: ["slack", "pagerduty"] as const,
  };

  const [created] = await db
    .insert(alerts)
    .values({
      repoId,
      ruleName: rule.name,
      severity: rule.severity,
      title: trigger.title,
      message: trigger.message,
      metricValue: trigger.metricValue.toFixed(2),
      threshold: trigger.threshold.toFixed(2),
      channels: [...rule.channels],
      metadata: trigger.metadata ?? {},
    })
    .returning();

  await enqueueNotification(created.id);

  return {
    id: created.id,
    repoId: created.repoId,
    ruleName: created.ruleName,
    severity: created.severity,
    title: created.title,
    message: created.message,
    channels: [...rule.channels],
  };
}

export async function triggerIncidentAiAlert(
  repoId: string,
  incidentTitle: string,
  incidentId: string
): Promise<CreatedAlert | null> {
  const shouldCreate = await checkDeduplication(repoId, "incident_ai_attributed");
  if (!shouldCreate) return null;

  const trigger: AlertTrigger = {
    title: "Incident Attributed to AI Code",
    message: `🚨 Production incident attributed to AI-generated code.\n\nIncident: ${incidentTitle}`,
    metricValue: 1,
    threshold: 1,
    metadata: { incidentId, incidentTitle },
  };

  const rule = {
    name: "incident_ai_attributed",
    severity: "critical" as const,
    channels: ["slack", "pagerduty"] as const,
  };

  const [created] = await db
    .insert(alerts)
    .values({
      repoId,
      ruleName: rule.name,
      severity: rule.severity,
      title: trigger.title,
      message: trigger.message,
      metricValue: trigger.metricValue.toFixed(2),
      threshold: trigger.threshold.toFixed(2),
      channels: [...rule.channels],
      metadata: trigger.metadata ?? {},
    })
    .returning();

  await enqueueNotification(created.id);

  return {
    id: created.id,
    repoId: created.repoId,
    ruleName: created.ruleName,
    severity: created.severity,
    title: created.title,
    message: created.message,
    channels: [...rule.channels],
  };
}
