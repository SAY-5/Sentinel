import {
  SkeletonCards,
  SkeletonCharts,
  SkeletonTable,
} from "@/components/dashboard/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />
      <SkeletonCards count={4} />
      <SkeletonCharts />
      <SkeletonTable rows={5} />
    </div>
  );
}
