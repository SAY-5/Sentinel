import { Suspense } from "react";
import { createTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RiskBadge } from "@/components/dashboard/risk-badge";
import { ConfidenceBadge } from "@/components/dashboard/confidence-badge";
import {
  SkeletonCards,
  SkeletonCharts,
  SkeletonTable,
} from "@/components/dashboard/skeletons";

const REPO_ID = "550e8400-e29b-41d4-a716-446655440003"; // SAY-5/Sentinel

async function OverviewMetrics() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const overview = await caller.metrics.getRepoOverview({ repoId: REPO_ID });

  const costPerHour = 150;
  const estimatedCost = overview.verificationTaxHours * costPerHour;

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        title="AI Code"
        value={`${overview.aiCodePercentage.toFixed(1)}%`}
        icon="bot"
        tooltip={`Percentage of commits containing AI-generated code (ai_confidence > 50%).\n\nHigh percentages may indicate over-reliance on AI assistants.`}
      />
      <MetricCard
        title="Verification Tax"
        value={`${overview.verificationTaxHours.toFixed(1)}h`}
        icon="clock"
        tooltip={`Time spent reviewing AI-generated code.\n\nCalculation: avg_review_time × ai_commits\n\nEstimated cost: $${estimatedCost.toLocaleString()} (@$${costPerHour}/hr)`}
      />
      <MetricCard
        title="High Risk Files"
        value={overview.highRiskFiles}
        icon="alert-triangle"
        tooltip={`Files classified as T3 (core logic) or T4 (critical infrastructure).\n\nThese contain security-sensitive or business-critical code that requires extra review attention.`}
      />
      <MetricCard
        title="Open Incidents"
        value={overview.openIncidents}
        icon="flame"
        variant={overview.openIncidents > 0 ? "danger" : "default"}
        tooltip={`Production incidents currently under investigation.\n\nIncidents are correlated with recent code changes to identify if AI-generated code was involved.`}
      />
    </div>
  );
}

async function TrendCharts() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const metrics = await caller.metrics.getRepoMetrics({
    repoId: REPO_ID,
    days: 30,
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <TrendChart
        title="AI Code Percentage"
        data={metrics}
        dataKey="aiCodePercentage"
        yAxisLabel="%"
      />
      <TrendChart
        title="Commit Distribution"
        data={metrics}
        dataKey="aiCommits"
        secondaryKey="humanCommits"
        yAxisLabel="commits"
      />
    </div>
  );
}

async function RecentHighRiskFiles() {
  const ctx = await createTRPCContext();
  const caller = appRouter.createCaller(ctx);
  const files = await caller.metrics.getHighRiskFiles({
    repoId: REPO_ID,
    minScore: 0.3,
    limit: 5,
  });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-4">
        <h3 className="text-sm font-medium">High Risk Files</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Risk</th>
            <th className="px-4 py-3 font-medium">AI Confidence</th>
            <th className="px-4 py-3 font-medium">Lines</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="border-b border-zinc-800 last:border-0">
              <td className="px-4 py-3">
                <span className="font-mono text-xs">{file.filePath}</span>
              </td>
              <td className="px-4 py-3">
                <RiskBadge tier={file.riskTier} />
              </td>
              <td className="px-4 py-3">
                <ConfidenceBadge value={file.aiConfidence} />
              </td>
              <td className="px-4 py-3 tabular-nums text-zinc-400">
                +{file.linesAdded}
              </td>
            </tr>
          ))}
          {files.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                No high-risk files found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <Suspense fallback={<SkeletonCards count={4} />}>
        <OverviewMetrics />
      </Suspense>

      <Suspense fallback={<SkeletonCharts />}>
        <TrendCharts />
      </Suspense>

      <Suspense fallback={<SkeletonTable rows={5} />}>
        <RecentHighRiskFiles />
      </Suspense>
    </div>
  );
}
