import { cn } from "@/lib/utils";

type Severity = "critical" | "warning" | "info";

const STYLES: Record<Severity, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  warning: "bg-amber-950 text-amber-300 border-amber-800",
  info: "bg-blue-950 text-blue-300 border-blue-800",
};

const LABELS: Record<Severity, string> = {
  critical: "CRITICAL",
  warning: "WARNING",
  info: "INFO",
};

interface SeverityBadgeProps {
  severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border",
        STYLES[severity]
      )}
    >
      {LABELS[severity]}
    </span>
  );
}
