import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { repositories } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import {
  computeDailyMetrics,
  acquireLock,
  releaseLock,
  getYesterday,
  parseDateRange,
} from "@/server/services/metrics";
import { evaluateAlertsForRepo } from "@/alerts/evaluator";

const log = createLogger({ job: "compute-metrics" });

export interface ComputeMetricsJobData {
  date?: string;
  startDate?: string;
  endDate?: string;
  repoId?: string;
}

export async function computeMetricsJob(
  data: ComputeMetricsJobData
): Promise<{ processed: number; skipped: number }> {
  const startTime = Date.now();

  const dates = resolveDates(data);
  const repos = await getRepos(data.repoId);

  log.info({ dates: dates.length, repos: repos.length }, "starting metrics computation");

  let processed = 0;
  let skipped = 0;

  for (const repo of repos) {
    for (const date of dates) {
      const lock = await acquireLock("compute-metrics", repo.id, date);

      if (!lock) {
        log.debug({ repoId: repo.id, date }, "skipped - lock held");
        skipped++;
        continue;
      }

      try {
        await computeDailyMetrics(repo.id, date);
        processed++;
        
        if (dates.length > 1) {
          log.info({ repoId: repo.id, date, processed, total: dates.length }, "backfill progress");
        }
      } finally {
        await releaseLock(lock);
      }
    }

    // After processing all dates for this repo, evaluate alerts
    try {
      const triggeredAlerts = await evaluateAlertsForRepo(repo.id);
      if (triggeredAlerts.length > 0) {
        log.info(
          { repoId: repo.id, alertCount: triggeredAlerts.length },
          "alerts triggered"
        );
      }
    } catch (err) {
      log.error({ repoId: repo.id, err: (err as Error).message }, "alert evaluation failed");
    }
  }

  const durationMs = Date.now() - startTime;
  log.info({ processed, skipped, durationMs }, "metrics computation complete");

  return { processed, skipped };
}

function resolveDates(data: ComputeMetricsJobData): string[] {
  if (data.startDate && data.endDate) {
    return parseDateRange(data.startDate, data.endDate);
  }

  return [data.date || getYesterday()];
}

async function getRepos(repoId?: string) {
  if (repoId) {
    const repo = await db.query.repositories.findFirst({
      where: eq(repositories.id, repoId),
      columns: { id: true },
    });
    return repo ? [repo] : [];
  }

  return await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(eq(repositories.isActive, true));
}
