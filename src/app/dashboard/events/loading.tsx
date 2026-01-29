import { SkeletonTable } from "@/components/dashboard/skeletons";

export default function EventsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />
      <SkeletonTable rows={10} />
    </div>
  );
}
