import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-zinc-800", className)}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="mt-3 h-8 w-16" />
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-4 h-48 w-full" />
    </div>
  );
}

export function SkeletonCharts() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <SkeletonChart />
      <SkeletonChart />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-zinc-800">
      <td className="py-3 pr-4">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="py-3 pr-4">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="py-3 pr-4">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="py-3">
        <Skeleton className="h-4 w-24" />
      </td>
    </tr>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <table className="w-full">
        <tbody className="px-4">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
