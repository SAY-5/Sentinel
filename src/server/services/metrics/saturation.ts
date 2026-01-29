import { eq, and, sql, gte } from "drizzle-orm";
import { db } from "@/server/db/client";
import { codeEvents } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import type { SaturationResult } from "./types";

const log = createLogger({ service: "metrics-saturation" });

const HOURS_PER_REVIEWER_PER_DAY = 8;
const HIGH_SATURATION_THRESHOLD = 0.8;

export async function monitorSaturation(repoId: string): Promise<SaturationResult> {
  const jobLog = log.child({ repoId });

  jobLog.info("monitoring review saturation");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const activeReviewers = await countActiveReviewers(repoId, sevenDaysAgo);
  const avgReviewTimeMins = await computeAvgReviewTime(repoId, sevenDaysAgo);
  const totalPRsOpened = await countPRsOpened(repoId, sevenDaysAgo);

  const prsPerDay = totalPRsOpened / 7;

  let capacityPerDay = 0;
  let saturation = 0;

  if (avgReviewTimeMins > 0 && activeReviewers > 0) {
    const minsPerReviewerPerDay = HOURS_PER_REVIEWER_PER_DAY * 60;
    capacityPerDay =
      (activeReviewers * minsPerReviewerPerDay) / avgReviewTimeMins;
    saturation = capacityPerDay > 0 ? prsPerDay / capacityPerDay : 0;
  }

  const isHighSaturation = saturation > HIGH_SATURATION_THRESHOLD;

  const result: SaturationResult = {
    activeReviewers,
    avgReviewTimeMins,
    prsPerDay,
    capacityPerDay,
    saturation,
    isHighSaturation,
  };

  if (isHighSaturation) {
    jobLog.warn(
      {
        reviewers: activeReviewers,
        avgReviewMins: avgReviewTimeMins.toFixed(1),
        prsPerDay: prsPerDay.toFixed(1),
        capacity: capacityPerDay.toFixed(1),
        saturation: saturation.toFixed(2),
      },
      "review saturation high"
    );
  } else {
    jobLog.info(
      {
        reviewers: activeReviewers,
        avgReviewMins: avgReviewTimeMins.toFixed(1),
        prsPerDay: prsPerDay.toFixed(1),
        capacity: capacityPerDay.toFixed(1),
        saturation: saturation.toFixed(2),
      },
      "saturation check complete"
    );
  }

  return result;
}

async function countActiveReviewers(
  repoId: string,
  since: Date
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(DISTINCT author_login)::int` })
    .from(codeEvents)
    .where(
      and(
        eq(codeEvents.repoId, repoId),
        eq(codeEvents.eventType, "pr_reviewed"),
        gte(codeEvents.timestamp, since)
      )
    );

  return result?.count ?? 0;
}

async function computeAvgReviewTime(
  repoId: string,
  since: Date
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
        gte(codeEvents.timestamp, since),
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

async function countPRsOpened(repoId: string, since: Date): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(codeEvents)
    .where(
      and(
        eq(codeEvents.repoId, repoId),
        eq(codeEvents.eventType, "pr_opened"),
        gte(codeEvents.timestamp, since)
      )
    );

  return result?.count ?? 0;
}
