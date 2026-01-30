import { Suspense } from "react";
import { createTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { SkeletonTable } from "@/components/dashboard/skeletons";
import { formatDistanceToNow } from "@/lib/format";

const REPO_ID = "550e8400-e29b-41d4-a716-446655440003"; // SAY-5/Sentinel

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  commit: { label: "Commit", color: "bg-blue-500" },
  pr_opened: { label: "PR Opened", color: "bg-purple-500" },
  pr_reviewed: { label: "PR Review", color: "bg-cyan-500" },
  pr_merged: { label: "PR Merged", color: "bg-green-500" },
  deploy: { label: "Deploy", color: "bg-amber-500" },
  incident: { label: "Incident", color: "bg-red-500" },
};

async function EventsTable() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const { items } = await caller.events.getCodeEvents({
    repoId: REPO_ID,
    limit: 50,
  });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Details</th>
            <th className="px-4 py-3 font-medium">Author</th>
            <th className="px-4 py-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {items.map((event) => {
            const config = EVENT_TYPE_LABELS[event.eventType] || {
              label: event.eventType,
              color: "bg-zinc-500",
            };
            const metadata = event.metadata as Record<string, unknown>;
            const message = typeof metadata?.message === "string" ? metadata.message : null;
            const title = typeof metadata?.title === "string" ? metadata.title : null;

            return (
              <tr
                key={event.id}
                className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-medium ${config.color}/20 text-zinc-200`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${config.color}`}
                    />
                    {config.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {event.commitSha && (
                    <span className="font-mono text-xs text-zinc-400">
                      {event.commitSha.slice(0, 7)}
                    </span>
                  )}
                  {event.prNumber && (
                    <span className="text-zinc-400">#{event.prNumber}</span>
                  )}
                  {message && (
                    <span className="ml-2 text-zinc-300">
                      {message.slice(0, 50)}
                    </span>
                  )}
                  {title && (
                    <span className="ml-2 text-zinc-300">
                      {title.slice(0, 50)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-300">{event.authorLogin}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {formatDistanceToNow(new Date(event.timestamp))}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                No events found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Events</h1>

      <Suspense fallback={<SkeletonTable rows={10} />}>
        <EventsTable />
      </Suspense>
    </div>
  );
}
