import { Suspense } from "react";
import { createTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { SkeletonTable } from "@/components/dashboard/skeletons";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const REPO_ID = "550e8400-e29b-41d4-a716-446655440001";

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  sev1: { label: "SEV1", className: "bg-red-500/20 text-red-300" },
  sev2: { label: "SEV2", className: "bg-orange-500/20 text-orange-300" },
  sev3: { label: "SEV3", className: "bg-amber-500/20 text-amber-300" },
  sev4: { label: "SEV4", className: "bg-zinc-500/20 text-zinc-300" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  investigating: { label: "Investigating", className: "text-amber-400" },
  identified: { label: "Identified", className: "text-blue-400" },
  resolved: { label: "Resolved", className: "text-green-400" },
};

async function IncidentsTable() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const incidents = await caller.incidents.getIncidents({ repoId: REPO_ID });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="px-4 py-3 font-medium">Severity</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Suspected Commit</th>
            <th className="px-4 py-3 font-medium">AI Attributed</th>
            <th className="px-4 py-3 font-medium">Detected</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => {
            const sevConfig = SEVERITY_CONFIG[incident.severity];
            const statusConfig = STATUS_CONFIG[incident.status];

            return (
              <tr
                key={incident.id}
                className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
              >
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded px-2 py-1 text-xs font-medium",
                      sevConfig.className
                    )}
                  >
                    {sevConfig.label}
                  </span>
                </td>
                <td className="max-w-md truncate px-4 py-3" title={incident.title}>
                  {incident.title}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-sm", statusConfig.className)}>
                    {statusConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {incident.suspectedCommitSha ? (
                    <span className="font-mono text-xs text-zinc-400">
                      {incident.suspectedCommitSha.slice(0, 7)}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {incident.aiAttributed === true && (
                    <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300">
                      AI
                    </span>
                  )}
                  {incident.aiAttributed === false && (
                    <span className="rounded bg-green-500/20 px-2 py-1 text-xs text-green-300">
                      Human
                    </span>
                  )}
                  {incident.aiAttributed === null && (
                    <span className="text-zinc-600">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {formatDateTime(new Date(incident.detectedAt))}
                </td>
              </tr>
            );
          })}
          {incidents.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                No incidents found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

async function IncidentsSummary() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const incidents = await caller.incidents.getIncidents({ repoId: REPO_ID });

  const total = incidents.length;
  const aiAttributed = incidents.filter((i) => i.aiAttributed === true).length;
  const open = incidents.filter((i) => i.status !== "resolved").length;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-400">Total Incidents</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-400">AI Attributed</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-red-400">
          {aiAttributed}
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-400">Open</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">
          {open}
        </p>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Incidents</h1>

      <Suspense
        fallback={
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-zinc-800"
              />
            ))}
          </div>
        }
      >
        <IncidentsSummary />
      </Suspense>

      <Suspense fallback={<SkeletonTable rows={5} />}>
        <IncidentsTable />
      </Suspense>
    </div>
  );
}
