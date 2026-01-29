import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/crypto";
import { webhookQueue, type GitHubEventType } from "@/lib/queue";
import { createLogger } from "@/lib/logger";
import { db } from "@/server/db/client";
import { repositories } from "@/server/db/schema";

const log = createLogger({ module: "webhook" });

const SUPPORTED_EVENTS = new Set([
  "push",
  "pull_request",
  "pull_request_review",
  "deployment_status",
]);

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery") || "unknown";

  const reqLog = log.child({ deliveryId, event });

  // Skip unsupported events early
  if (!event || !SUPPORTED_EVENTS.has(event)) {
    reqLog.debug("skipping unsupported event");
    return NextResponse.json({ ok: true, skipped: "unsupported event" });
  }

  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    reqLog.warn("invalid webhook signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    reqLog.warn("invalid JSON payload");
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const installation = payload.installation as { id?: number } | undefined;
  const repository = payload.repository as { id?: number } | undefined;

  if (!installation?.id || !repository?.id) {
    reqLog.debug("not a repo-level event");
    return NextResponse.json({ ok: true, skipped: "not repo event" });
  }

  const installationId = installation.id;
  const githubRepoId = repository.id;

  // Check if we track this repo
  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.githubId, githubRepoId),
    columns: { id: true, isActive: true },
  });

  if (!repo) {
    reqLog.debug({ githubRepoId }, "repo not tracked");
    return NextResponse.json({ ok: true, skipped: "untracked repo" });
  }

  if (!repo.isActive) {
    reqLog.debug({ repoId: repo.id }, "repo inactive");
    return NextResponse.json({ ok: true, skipped: "repo inactive" });
  }

  // Enqueue for async processing
  await webhookQueue.add(
    event,
    {
      deliveryId,
      event: event as GitHubEventType,
      installationId,
      repoId: repo.id,
      payload,
      receivedAt: new Date().toISOString(),
    },
    { jobId: deliveryId }
  );

  reqLog.info({ repoId: repo.id }, "webhook queued");

  return NextResponse.json({ ok: true, queued: deliveryId });
}
