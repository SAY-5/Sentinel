import { Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import type { AnalysisJobData } from "@/lib/queue";
import { createLogger } from "@/lib/logger";
import { db } from "@/server/db/client";
import { codeAttribution, codeEvents } from "@/server/db/schema";
import { getCommit, getPullRequest } from "@/lib/github";
import { detectAI } from "@/analysis/detector";
import type { CommitData } from "@/analysis/types";

const log = createLogger({ module: "analysis-worker" });

export async function processAnalysis(job: Job<AnalysisJobData>) {
  const { repoId, commitSha, eventId, installationId, owner, repo } = job.data;
  const jobLog = log.child({ commitSha, repoId });

  jobLog.info("starting analysis");

  // Check if already analyzed
  const existing = await db.query.codeAttribution.findFirst({
    where: and(
      eq(codeAttribution.commitSha, commitSha),
      eq(codeAttribution.repoId, repoId)
    ),
    columns: { id: true },
  });

  if (existing) {
    jobLog.debug("commit already analyzed, skipping");
    return;
  }

  // Fetch commit details from GitHub
  const commitDetails = await getCommit(installationId, owner, repo, commitSha);

  // Check if this commit is associated with a PR
  const event = await db.query.codeEvents.findFirst({
    where: eq(codeEvents.id, eventId),
    columns: { prNumber: true },
  });

  let prBody: string | undefined;
  if (event?.prNumber) {
    try {
      const pr = await getPullRequest(
        installationId,
        owner,
        repo,
        event.prNumber
      );
      prBody = pr.body || undefined;
    } catch {
      jobLog.warn({ prNumber: event.prNumber }, "failed to fetch PR details");
    }
  }

  const commitData: CommitData = {
    sha: commitDetails.sha,
    message: commitDetails.message,
    authorLogin: commitDetails.author,
    timestamp: commitDetails.timestamp,
    files: commitDetails.files.map((f) => ({
      path: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
    prNumber: event?.prNumber ?? undefined,
    prBody,
  };

  // Run AI detection
  const result = await detectAI(commitData);

  // Store results per file
  for (const file of commitData.files) {
    await db.insert(codeAttribution).values({
      repoId,
      commitSha,
      filePath: file.path,
      aiConfidence: result.confidence.toFixed(2),
      detectionMethod: result.method,
      detectionSignals: result.signals,
      riskTier: result.riskTier,
      riskScore: result.riskScore.toFixed(2),
      riskExplanation: result.explanation,
      linesAdded: file.additions,
      linesDeleted: file.deletions,
      analyzedAt: new Date(),
    });
  }

  jobLog.info(
    {
      confidence: result.confidence,
      riskTier: result.riskTier,
      files: commitData.files.length,
    },
    "analysis complete"
  );
}
