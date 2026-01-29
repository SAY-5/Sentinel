import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import type { WebhookJobData, AnalysisJobData } from "@/lib/queue";
import { analysisQueue } from "@/lib/queue";
import { createLogger } from "@/lib/logger";
import { db } from "@/server/db/client";
import { codeEvents, repositories } from "@/server/db/schema";
import { getPullRequest, listPRCommits } from "@/lib/github";

const log = createLogger({ module: "webhook-worker" });

interface PushPayload {
  ref: string;
  commits: Array<{
    id: string;
    message: string;
    author: { username?: string; name?: string };
    timestamp: string;
  }>;
  repository: { owner: { login: string }; name: string };
}

interface PRPayload {
  action: string;
  number: number;
  pull_request: {
    title: string;
    body: string | null;
    user: { login: string };
    merged_at: string | null;
    merge_commit_sha: string | null;
  };
  repository: { owner: { login: string }; name: string };
}

export async function processWebhook(job: Job<WebhookJobData>) {
  const { event, repoId, deliveryId, installationId, payload } = job.data;
  const jobLog = log.child({ deliveryId, event, repoId });

  jobLog.info("processing webhook");

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, repoId),
    columns: { owner: true, name: true },
  });

  if (!repo) {
    jobLog.warn("repo not found, skipping");
    return;
  }

  switch (event) {
    case "push":
      await handlePush(job.data, payload as PushPayload, repo, jobLog);
      break;
    case "pull_request":
      await handlePR(job.data, payload as PRPayload, repo, jobLog);
      break;
    case "pull_request_review":
      await handlePRReview(job.data, payload, jobLog);
      break;
    case "deployment_status":
      await handleDeploy(job.data, payload, jobLog);
      break;
  }

  jobLog.info("webhook processed");
}

async function handlePush(
  job: WebhookJobData,
  payload: PushPayload,
  repo: { owner: string; name: string },
  jobLog: ReturnType<typeof createLogger>
) {
  const commits = payload.commits || [];
  jobLog.info({ commitCount: commits.length }, "processing push");

  for (const commit of commits) {
    const [event] = await db
      .insert(codeEvents)
      .values({
        repoId: job.repoId,
        eventType: "commit",
        timestamp: new Date(commit.timestamp),
        commitSha: commit.id,
        authorLogin: commit.author.username || commit.author.name || "unknown",
        metadata: { message: commit.message, ref: payload.ref },
      })
      .returning({ id: codeEvents.id });

    await analysisQueue.add("analyze", {
      repoId: job.repoId,
      commitSha: commit.id,
      eventId: event.id,
      installationId: job.installationId,
      owner: repo.owner,
      repo: repo.name,
    } satisfies AnalysisJobData);
  }
}

async function handlePR(
  job: WebhookJobData,
  payload: PRPayload,
  repo: { owner: string; name: string },
  jobLog: ReturnType<typeof createLogger>
) {
  const { action, number, pull_request: pr } = payload;

  let eventType: "pr_opened" | "pr_merged";
  if (action === "opened" || action === "reopened") {
    eventType = "pr_opened";
  } else if (action === "closed" && pr.merged_at) {
    eventType = "pr_merged";
  } else {
    jobLog.debug({ action }, "skipping PR action");
    return;
  }

  const [event] = await db
    .insert(codeEvents)
    .values({
      repoId: job.repoId,
      eventType,
      timestamp: new Date(),
      prNumber: number,
      commitSha: pr.merge_commit_sha,
      authorLogin: pr.user.login,
      metadata: { title: pr.title, action },
    })
    .returning({ id: codeEvents.id });

  jobLog.info({ eventType, prNumber: number }, "PR event recorded");

  // Fetch PR details for AI mention analysis
  if (eventType === "pr_opened") {
    const prDetails = await getPullRequest(
      job.installationId,
      repo.owner,
      repo.name,
      number
    );

    // Queue analysis for each commit in the PR
    const commitShas = await listPRCommits(
      job.installationId,
      repo.owner,
      repo.name,
      number
    );

    for (const sha of commitShas) {
      await analysisQueue.add("analyze", {
        repoId: job.repoId,
        commitSha: sha,
        eventId: event.id,
        installationId: job.installationId,
        owner: repo.owner,
        repo: repo.name,
      } satisfies AnalysisJobData);
    }

    jobLog.info(
      { prNumber: number, commits: commitShas.length },
      "queued PR commits for analysis"
    );
  }
}

async function handlePRReview(
  job: WebhookJobData,
  payload: unknown,
  jobLog: ReturnType<typeof createLogger>
) {
  const p = payload as {
    action: string;
    review: { user: { login: string } };
    pull_request: { number: number };
  };

  if (p.action !== "submitted") return;

  await db.insert(codeEvents).values({
    repoId: job.repoId,
    eventType: "pr_reviewed",
    timestamp: new Date(),
    prNumber: p.pull_request.number,
    authorLogin: p.review.user.login,
    metadata: { action: p.action },
  });

  jobLog.info({ prNumber: p.pull_request.number }, "PR review recorded");
}

async function handleDeploy(
  job: WebhookJobData,
  payload: unknown,
  jobLog: ReturnType<typeof createLogger>
) {
  const p = payload as {
    deployment_status: { state: string };
    deployment: {
      sha: string;
      environment: string;
      creator: { login: string };
    };
  };

  if (p.deployment_status.state !== "success") return;

  await db.insert(codeEvents).values({
    repoId: job.repoId,
    eventType: "deploy",
    timestamp: new Date(),
    commitSha: p.deployment.sha,
    authorLogin: p.deployment.creator.login,
    metadata: { environment: p.deployment.environment },
  });

  jobLog.info(
    { sha: p.deployment.sha, env: p.deployment.environment },
    "deploy recorded"
  );
}
