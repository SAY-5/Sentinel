import { SkeletonTable } from "@/components/dashboard/skeletons";

export default function RiskLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
      <SkeletonTable rows={10} />
    </div>
  );
}
