import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { repositories } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";
import {
  monitorSaturation,
  acquireLock,
  releaseLock,
  getToday,
} from "@/server/services/metrics";
import type { SaturationResult } from "@/server/services/metrics";

const log = createLogger({ job: "monitor-saturation" });

export interface MonitorSaturationJobData {
  repoId?: string;
}

export async function monitorSaturationJob(
  data: MonitorSaturationJobData
): Promise<{ repos: number; highSaturation: number }> {
  const startTime = Date.now();
  const today = getToday();

  const repos = await getRepos(data.repoId);
  log.info({ repos: repos.length }, "starting saturation monitoring");

  let highSaturation = 0;
  const results: Array<{ repoId: string; result: SaturationResult }> = [];

  for (const repo of repos) {
    const lock = await acquireLock("monitor-saturation", repo.id, today);

    if (!lock) {
      log.debug({ repoId: repo.id }, "skipped - lock held");
      continue;
    }

    try {
      const result = await monitorSaturation(repo.id);
      results.push({ repoId: repo.id, result });

      if (result.isHighSaturation) {
        highSaturation++;
      }
    } finally {
      await releaseLock(lock);
    }
  }

  const durationMs = Date.now() - startTime;
  log.info(
    { repos: repos.length, highSaturation, durationMs },
    "saturation monitoring complete"
  );

  return { repos: repos.length, highSaturation };
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
