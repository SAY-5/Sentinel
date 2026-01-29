import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alerts } from "@/server/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api/alerts/acknowledge" });

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: alertId } = await params;

  if (!alertId || typeof alertId !== "string") {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(alerts)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedBy: "anonymous",
      })
      .where(eq(alerts.id, alertId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    log.info({ alertId }, "alert acknowledged");

    return NextResponse.json({ success: true, alert: updated });
  } catch (err) {
    log.error({ alertId, err: (err as Error).message }, "failed to acknowledge alert");
    return NextResponse.json(
      { error: "Failed to acknowledge alert" },
      { status: 500 }
    );
  }
}
