import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  codeEvents,
  codeAttribution,
  incidents,
  repoMetrics,
} from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import type { DailyMetricsResult, DateWindow } from "./types";
import { getDateWindow } from "./utils";

const log = createLogger({ service: "metrics-daily" });

export async function computeDailyMetrics(
  repoId: string,
  dateStr: string
): Promise<DailyMetricsResult> {
  const window = getDateWindow(dateStr);
  const jobLog = log.child({ repoId, date: dateStr });

  jobLog.info("computing daily metrics");

  const totalCommits = await countCommits(repoId, window);
  const aiCommits = await countAiCommits(repoId, window);
  const humanCommits = Math.max(0, totalCommits - aiCommits);
  const aiCodePercentage =
    totalCommits > 0 ? (aiCommits / totalCommits) * 100 : 0;

  const avgReviewTimeMins = await computeAvgReviewTime(repoId, window);
  const highRiskFileCount = await countHighRiskFiles(repoId, window);
  const incidentCount = await countIncidents(repoId, window);
  const verificationTaxHours =
    avgReviewTimeMins > 0 ? (avgReviewTimeMins * aiCommits) / 60 : 0;

  const result: DailyMetricsResult = {
    totalCommits,
    aiCommits,
    humanCommits,
    aiCodePercentage,
    avgReviewTimeMins,
    highRiskFileCount,
    incidentCount,
    verificationTaxHours,
  };

  await upsertMetrics(repoId, dateStr, result);

  jobLog.info(
    {
      totalCommits,
      aiCommits,
      aiCodePercentage: aiCodePercentage.toFixed(1),
      avgReviewTimeMins: avgReviewTimeMins.toFixed(1),
      highRiskFileCount,
      incidentCount,
    },
    "daily metrics computed"
  );

  return result;
}

async function countCommits(repoId: string, window: DateWindow): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(codeEvents)
    .where(
      and(
        eq(codeEvents.repoId, repoId),
        eq(codeEvents.eventType, "commit"),
        gte(codeEvents.timestamp, window.start),
        lte(codeEvents.timestamp, window.end)
      )
    );

  return result?.count ?? 0;
}

async function countAiCommits(repoId: string, window: DateWindow): Promise<number> {
  const commitEvents = await db
    .select({ commitSha: codeEvents.commitSha })
    .from(codeEvents)
    .where(
      and(
        eq(codeEvents.repoId, repoId),
        eq(codeEvents.eventType, "commit"),
        gte(codeEvents.timestamp, window.start),
        lte(codeEvents.timestamp, window.end),
        sql`commit_sha IS NOT NULL`
      )
    );

  if (commitEvents.length === 0) return 0;

  const shas = commitEvents
    .map((e) => e.commitSha)
    .filter((s): s is string => s !== null);

  if (shas.length === 0) return 0;

  const [result] = await db
    .select({ count: sql<number>`count(DISTINCT commit_sha)::int` })
    .from(codeAttribution)
    .where(
      and(
        eq(codeAttribution.repoId, repoId),
        inArray(codeAttribution.commitSha, shas),
        sql`ai_confidence::numeric > 0.5`
      )
    );

  return result?.count ?? 0;
}

async function computeAvgReviewTime(
  repoId: string,
  window: DateWindow
): Promise<number> {
  const mergedPRs = await db
    .select({
      prNumber: codeEvents.prNumber,
      mergedAt: codeEvents.timestamp,
    })
    .from(codeEvents)
    .where(
      and(
        eq(codeEvents.repoId, repoId),
        eq(codeEvents.eventType, "pr_merged"),
        gte(codeEvents.timestamp, window.start),
        lte(codeEvents.timestamp, window.end),
        sql`pr_number IS NOT NULL`
      )
    );

  if (mergedPRs.length === 0) return 0;

  const reviewTimes: number[] = [];

  for (const pr of mergedPRs) {
    if (!pr.prNumber) continue;

    const openEvent = await db.query.codeEvents.findFirst({
      where: and(
        eq(codeEvents.repoId, repoId),
        eq(codeEvents.eventType, "pr_opened"),
        eq(codeEvents.prNumber, pr.prNumber)
      ),
      columns: { timestamp: true },
    });

    if (openEvent) {
      const diffMs = pr.mergedAt.getTime() - openEvent.timestamp.getTime();
      const diffMins = diffMs / 1000 / 60;
      if (diffMins > 0) {
        reviewTimes.push(diffMins);
      }
    }
  }

  if (reviewTimes.length === 0) return 0;

  return reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length;
}

async function countHighRiskFiles(
  repoId: string,
  window: DateWindow
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(codeAttribution)
    .where(
      and(
        eq(codeAttribution.repoId, repoId),
        sql`risk_tier IN ('T3_core', 'T4_novel')`,
        gte(codeAttribution.analyzedAt, window.start),
        lte(codeAttribution.analyzedAt, window.end)
      )
    );

  return result?.count ?? 0;
}

async function countIncidents(
  repoId: string,
  window: DateWindow
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidents)
    .where(
      and(
        eq(incidents.repoId, repoId),
        gte(incidents.detectedAt, window.start),
        lte(incidents.detectedAt, window.end)
      )
    );

  return result?.count ?? 0;
}

async function upsertMetrics(
  repoId: string,
  dateStr: string,
  result: DailyMetricsResult
): Promise<void> {
  await db
    .insert(repoMetrics)
    .values({
      repoId,
      date: dateStr,
      period: "day",
      totalCommits: result.totalCommits,
      aiCommits: result.aiCommits,
      humanCommits: result.humanCommits,
      aiCodePercentage: result.aiCodePercentage.toFixed(2),
      avgReviewTimeMins: result.avgReviewTimeMins.toFixed(2),
      highRiskFileCount: result.highRiskFileCount,
      incidentCount: result.incidentCount,
      verificationTaxHours: result.verificationTaxHours.toFixed(2),
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [repoMetrics.repoId, repoMetrics.date, repoMetrics.period],
      set: {
        totalCommits: result.totalCommits,
        aiCommits: result.aiCommits,
        humanCommits: result.humanCommits,
        aiCodePercentage: result.aiCodePercentage.toFixed(2),
        avgReviewTimeMins: result.avgReviewTimeMins.toFixed(2),
        highRiskFileCount: result.highRiskFileCount,
        incidentCount: result.incidentCount,
        verificationTaxHours: result.verificationTaxHours.toFixed(2),
        computedAt: new Date(),
      },
    });
}
