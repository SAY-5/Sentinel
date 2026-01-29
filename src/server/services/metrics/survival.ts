import { eq, and, sql, gte, lte, gt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { codeAttribution } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import type { SurvivalCheckResult, DateWindow } from "./types";
import { getDaysAgo, getDateWindow, getToday } from "./utils";

const log = createLogger({ service: "metrics-survival" });

export async function trackSurvival(repoId: string): Promise<SurvivalCheckResult> {
  const cohortDate = getDaysAgo(30);
  const today = getToday();
  const window = getDateWindow(cohortDate);
  const jobLog = log.child({ repoId, cohortDate });

  jobLog.info("tracking code survival");

  const candidates = await db
    .select({
      id: codeAttribution.id,
      filePath: codeAttribution.filePath,
      commitSha: codeAttribution.commitSha,
      aiConfidence: codeAttribution.aiConfidence,
      riskTier: codeAttribution.riskTier,
      metadata: codeAttribution.metadata,
    })
    .from(codeAttribution)
    .where(
      and(
        eq(codeAttribution.repoId, repoId),
        sql`ai_confidence::numeric > 0.5`,
        gte(codeAttribution.analyzedAt, window.start),
        lte(codeAttribution.analyzedAt, window.end)
      )
    );

  let checked = 0;
  let survived = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of candidates) {
    const meta = (row.metadata as Record<string, unknown>) || {};

    if (meta.survival_checked_at === today) {
      skipped++;
      continue;
    }

    checked++;

    const laterAttribution = await db.query.codeAttribution.findFirst({
      where: and(
        eq(codeAttribution.repoId, repoId),
        eq(codeAttribution.filePath, row.filePath),
        gt(codeAttribution.analyzedAt, window.end)
      ),
      columns: { id: true },
    });

    const didSurvive = laterAttribution !== undefined;

    if (didSurvive) {
      survived++;
    } else {
      failed++;
    }

    await db
      .update(codeAttribution)
      .set({
        detectionSignals: sql`
          COALESCE(detection_signals, '{}'::jsonb) || 
          ${JSON.stringify({
            survival_checked_at: today,
            survived_30d: didSurvive,
          })}::jsonb
        `,
      })
      .where(eq(codeAttribution.id, row.id));
  }

  jobLog.info(
    { checked, survived, failed, skipped },
    "survival tracking complete"
  );

  return { checked, survived, failed, skipped };
}
