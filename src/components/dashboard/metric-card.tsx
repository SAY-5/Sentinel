import { Bot, Clock, AlertTriangle, Flame, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  clock: Clock,
  "alert-triangle": AlertTriangle,
  flame: Flame,
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof ICONS;
  variant?: "default" | "danger";
  tooltip?: string;
}

export function MetricCard({
  title,
  value,
  icon,
  variant = "default",
  tooltip,
}: MetricCardProps) {
  const Icon = ICONS[icon];

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-zinc-800 bg-zinc-900 p-4",
        variant === "danger" && "border-red-900/50 bg-red-950/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-zinc-400">{title}</p>
          {tooltip && (
            <div className="relative">
              <Info className="h-3.5 w-3.5 text-zinc-600 hover:text-zinc-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 
                            rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible
                            transition-all duration-200 z-50 shadow-xl">
                <div className="whitespace-pre-line">{tooltip}</div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1
                              border-4 border-transparent border-t-zinc-800" />
              </div>
            </div>
          )}
        </div>
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "danger" ? "text-red-400" : "text-zinc-500"
          )}
        />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
