import type { RepoMetric, Repository } from "@/server/db/schema";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertChannel = "slack" | "email" | "pagerduty";

export interface AlertTrigger {
  title: string;
  message: string;
  metricValue: number;
  threshold: number;
  metadata?: Record<string, unknown>;
}

export interface EvaluationContext {
  repo: Repository;
  currentMetrics: RepoMetric | null;
  previousMetrics: RepoMetric | null;
  saturationData?: {
    saturation: number;
    activeReviewers: number;
  };
}

export interface AlertRule {
  name: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  evaluate: (ctx: EvaluationContext) => AlertTrigger | null;
}

export interface CreatedAlert {
  id: string;
  repoId: string;
  ruleName: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  channels: AlertChannel[];
}
