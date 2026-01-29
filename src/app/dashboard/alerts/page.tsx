import { Suspense } from "react";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { AlertsTable } from "./alerts-table";
import { formatDistanceToNow } from "@/lib/format";

const REPO_ID = "550e8400-e29b-41d4-a716-446655440001";

async function AlertsSummary() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const summary = await caller.alerts.getSummary({ repoId: REPO_ID });

  return (
    <div className="grid grid-cols-4 gap-4">
      <SummaryCard
        title="Total Alerts"
        value={summary.total}
        subtitle="Last 30 days"
      />
      <SummaryCard
        title="Critical"
        value={summary.critical}
        variant={summary.critical > 0 ? "danger" : "default"}
      />
      <SummaryCard
        title="Unacknowledged"
        value={summary.unacknowledged}
        variant={summary.unacknowledged > 0 ? "warning" : "default"}
      />
      <RecentCard alert={summary.mostRecent} />
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: number;
  subtitle?: string;
  variant?: "default" | "danger" | "warning";
}

function SummaryCard({
  title,
  value,
  subtitle,
  variant = "default",
}: SummaryCardProps) {
  const borderClass =
    variant === "danger"
      ? "border-red-900/50"
      : variant === "warning"
        ? "border-amber-900/50"
        : "border-zinc-800";

  return (
    <div className={`rounded-lg border ${borderClass} bg-zinc-900 p-4`}>
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  );
}

interface RecentCardProps {
  alert: {
    title: string;
    triggeredAt: Date;
    severity: string;
  } | null;
}

function RecentCard({ alert }: RecentCardProps) {
  const isEmpty = !alert;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm text-zinc-400">Most Recent</p>
      {isEmpty ? (
        <p className="mt-2 text-sm text-zinc-500">No alerts</p>
      ) : (
        <>
          <p className="mt-1 text-sm font-medium truncate" title={alert.title}>
            {alert.title}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {formatDistanceToNow(alert.triggeredAt)}
          </p>
        </>
      )}
    </div>
  );
}

async function AlertsContent() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const alerts = await caller.alerts.getAlerts({ repoId: REPO_ID });

  return <AlertsTable alerts={alerts} />;
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
        />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="text-sm text-zinc-400">
          Monitor threshold violations and system warnings
        </p>
      </div>

      <Suspense fallback={<SummarySkeleton />}>
        <AlertsSummary />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <AlertsContent />
      </Suspense>
    </div>
  );
}
