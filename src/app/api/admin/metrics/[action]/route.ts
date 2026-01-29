import { NextRequest, NextResponse } from "next/server";
import { scheduledQueue } from "@/lib/queue";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "admin-api" });

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function verifyAdminKey(req: NextRequest): boolean {
  if (!ADMIN_API_KEY) {
    log.warn("ADMIN_API_KEY not configured");
    return false;
  }

  const key = req.headers.get("x-admin-key");
  return key === ADMIN_API_KEY;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  if (!verifyAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { action } = await params;
  const url = new URL(req.url);

  try {
    switch (action) {
      case "compute": {
        const date = url.searchParams.get("date") || undefined;
        const startDate = url.searchParams.get("startDate") || undefined;
        const endDate = url.searchParams.get("endDate") || undefined;
        const repoId = url.searchParams.get("repoId") || undefined;

        const jobId = `manual-compute-${Date.now()}`;
        await scheduledQueue.add(
          "compute-metrics-daily",
          { date, startDate, endDate, repoId },
          { jobId }
        );

        log.info({ jobId, date, startDate, endDate, repoId }, "compute metrics queued");

        return NextResponse.json({ ok: true, jobId, queued: 1 });
      }

      case "survival": {
        const repoId = url.searchParams.get("repoId") || undefined;

        const jobId = `manual-survival-${Date.now()}`;
        await scheduledQueue.add(
          "track-survival-weekly",
          { repoId },
          { jobId }
        );

        log.info({ jobId, repoId }, "survival tracking queued");

        return NextResponse.json({ ok: true, jobId, queued: 1 });
      }

      case "saturation": {
        const repoId = url.searchParams.get("repoId") || undefined;

        const jobId = `manual-saturation-${Date.now()}`;
        await scheduledQueue.add(
          "monitor-saturation-hourly",
          { repoId },
          { jobId }
        );

        log.info({ jobId, repoId }, "saturation monitoring queued");

        return NextResponse.json({ ok: true, jobId, queued: 1 });
      }

      default:
        return NextResponse.json(
          { error: "unknown action", valid: ["compute", "survival", "saturation"] },
          { status: 400 }
        );
    }
  } catch (err) {
    log.error({ action, err: (err as Error).message }, "admin action failed");
    return NextResponse.json(
      { error: "internal error" },
      { status: 500 }
    );
  }
}
