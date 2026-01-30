import { SkeletonCard } from "@/components/dashboard/skeletons";

export default function AlertsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />

      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
