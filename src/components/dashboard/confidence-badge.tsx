import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  value: number;
  showLabel?: boolean;
}

export function ConfidenceBadge({
  value,
  showLabel = true,
}: ConfidenceBadgeProps) {
  const percent = Math.round(value * 100);

  const colorClass =
    percent >= 70
      ? "bg-red-500"
      : percent >= 40
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-700">
        <div
          className={cn("h-full transition-all", colorClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums text-zinc-400">{percent}%</span>
      )}
    </div>
  );
}
