import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { repositories } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import {
  trackSurvival,
  acquireLock,
  releaseLock,
  getToday,
} from "@/server/services/metrics";

const log = createLogger({ job: "track-survival" });

export interface TrackSurvivalJobData {
  repoId?: string;
}

export async function trackSurvivalJob(
  data: TrackSurvivalJobData
): Promise<{ repos: number; totalChecked: number }> {
  const startTime = Date.now();
  const today = getToday();

  const repos = await getRepos(data.repoId);
  log.info({ repos: repos.length }, "starting survival tracking");

  let totalChecked = 0;

  for (const repo of repos) {
    const lock = await acquireLock("track-survival", repo.id, today);

    if (!lock) {
      log.debug({ repoId: repo.id }, "skipped - lock held");
      continue;
    }

    try {
      const result = await trackSurvival(repo.id);
      totalChecked += result.checked;
    } finally {
      await releaseLock(lock);
    }
  }

  const durationMs = Date.now() - startTime;
  log.info({ repos: repos.length, totalChecked, durationMs }, "survival tracking complete");

  return { repos: repos.length, totalChecked };
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
