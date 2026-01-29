import { Suspense } from "react";
import { createTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { SkeletonTable } from "@/components/dashboard/skeletons";
import { RiskBadge } from "@/components/dashboard/risk-badge";
import { ConfidenceBadge } from "@/components/dashboard/confidence-badge";
import { formatDistanceToNow } from "@/lib/format";

const REPO_ID = "550e8400-e29b-41d4-a716-446655440001";

async function RiskTable() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const files = await caller.metrics.getHighRiskFiles({
    repoId: REPO_ID,
    minScore: 0,
    limit: 50,
  });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="px-4 py-3 font-medium">File Path</th>
            <th className="px-4 py-3 font-medium">Commit</th>
            <th className="px-4 py-3 font-medium">Risk Tier</th>
            <th className="px-4 py-3 font-medium">Risk Score</th>
            <th className="px-4 py-3 font-medium">AI Confidence</th>
            <th className="px-4 py-3 font-medium">Lines</th>
            <th className="px-4 py-3 font-medium">Analyzed</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.id}
              className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
            >
              <td className="max-w-xs truncate px-4 py-3">
                <span className="font-mono text-xs" title={file.filePath}>
                  {file.filePath}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-zinc-400">
                  {file.commitSha.slice(0, 7)}
                </span>
              </td>
              <td className="px-4 py-3">
                <RiskBadge tier={file.riskTier} />
              </td>
              <td className="px-4 py-3">
                <span className="tabular-nums">
                  {(file.riskScore * 100).toFixed(0)}%
                </span>
              </td>
              <td className="px-4 py-3">
                <ConfidenceBadge value={file.aiConfidence} />
              </td>
              <td className="px-4 py-3 tabular-nums text-zinc-400">
                +{file.linesAdded}
              </td>
              <td className="px-4 py-3 text-zinc-500">
                {formatDistanceToNow(new Date(file.analyzedAt))}
              </td>
            </tr>
          ))}
          {files.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                No attribution data found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Risk Analysis</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Files sorted by risk score (highest first)
        </p>
      </div>

      <Suspense fallback={<SkeletonTable rows={10} />}>
        <RiskTable />
      </Suspense>
    </div>
  );
}
