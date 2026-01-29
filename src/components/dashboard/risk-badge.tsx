import { cn } from "@/lib/utils";

type RiskTier = "T1_boilerplate" | "T2_glue" | "T3_core" | "T4_novel";

const TIER_CONFIG: Record<RiskTier, { label: string; className: string }> = {
  T1_boilerplate: {
    label: "T1",
    className: "bg-zinc-700 text-zinc-300",
  },
  T2_glue: {
    label: "T2",
    className: "bg-blue-900/50 text-blue-300",
  },
  T3_core: {
    label: "T3",
    className: "bg-amber-900/50 text-amber-300",
  },
  T4_novel: {
    label: "T4",
    className: "bg-red-900/50 text-red-300",
  },
};

export function RiskBadge({ tier }: { tier: RiskTier }) {
  const config = TIER_CONFIG[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
