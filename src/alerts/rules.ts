import type { AlertRule, EvaluationContext, AlertTrigger } from "./types";

const COST_PER_HOUR = 150;

function formatCost(hours: number): string {
  const cost = Math.round(hours * COST_PER_HOUR);
  return `$${cost.toLocaleString()}`;
}

export const aiCodeHigh: AlertRule = {
  name: "ai_code_high",
  severity: "warning",
  channels: ["slack"],
  evaluate: (ctx: EvaluationContext): AlertTrigger | null => {
    const pct = Number(ctx.currentMetrics?.aiCodePercentage ?? 0);
    const threshold = 70;

    if (pct > threshold && pct <= 90) {
      return {
        title: "AI Code Threshold Warning",
        message: `⚠️ AI code now at ${pct.toFixed(1)}% of codebase. Monitor for quality issues and review bottlenecks.`,
        metricValue: pct,
        threshold,
      };
    }
    return null;
  },
};

export const aiCodeCritical: AlertRule = {
  name: "ai_code_critical",
  severity: "critical",
  channels: ["slack", "email"],
  evaluate: (ctx: EvaluationContext): AlertTrigger | null => {
    const pct = Number(ctx.currentMetrics?.aiCodePercentage ?? 0);
    const threshold = 90;

    if (pct > threshold) {
      return {
        title: "AI Code Threshold Critical",
        message: `🚨 CRITICAL: AI code at ${pct.toFixed(1)}%. Team may have lost manual code-writing capability. Immediate review recommended.`,
        metricValue: pct,
        threshold,
      };
    }
    return null;
  },
};

export const verificationTaxSpike: AlertRule = {
  name: "verification_tax_spike",
  severity: "warning",
  channels: ["slack"],
  evaluate: (ctx: EvaluationContext): AlertTrigger | null => {
    const current = Number(ctx.currentMetrics?.verificationTaxHours ?? 0);
    const previous = Number(ctx.previousMetrics?.verificationTaxHours ?? 0);

    if (previous === 0) return null;

    const threshold = previous * 1.5;
    const increase = ((current - previous) / previous) * 100;

    if (current > threshold) {
      return {
        title: "Verification Tax Spike",
        message: `📊 Verification tax spiked to ${current.toFixed(1)}h (up ${increase.toFixed(0)}% from last week). Review saturation may be increasing.`,
        metricValue: current,
        threshold,
        metadata: { previousValue: previous, increasePercent: increase },
      };
    }
    return null;
  },
};

export const verificationTaxAbsolute: AlertRule = {
  name: "verification_tax_absolute",
  severity: "critical",
  channels: ["slack", "email"],
  evaluate: (ctx: EvaluationContext): AlertTrigger | null => {
    const hours = Number(ctx.currentMetrics?.verificationTaxHours ?? 0);
    const threshold = 80;

    if (hours > threshold) {
      const cost = formatCost(hours);
      const monthlyCost = formatCost(hours * 4);

      return {
        title: "Verification Tax Critical",
        message: `🚨 Verification tax at ${hours.toFixed(1)}h/week. That's ${cost}/week (${monthlyCost}/month @ $${COST_PER_HOUR}/hr). Consider: reducing AI usage, adding reviewers, or automating T1 code reviews.`,
        metricValue: hours,
        threshold,
        metadata: { estimatedCost: hours * COST_PER_HOUR },
      };
    }
    return null;
  },
};

export const reviewSaturationHigh: AlertRule = {
  name: "review_saturation_high",
  severity: "warning",
  channels: ["slack"],
  evaluate: (ctx: EvaluationContext): AlertTrigger | null => {
    const saturation = ctx.saturationData?.saturation ?? 0;
    const threshold = 0.8;

    if (saturation > threshold) {
      const pct = (saturation * 100).toFixed(0);
      return {
        title: "Review Saturation High",
        message: `⚠️ Review saturation at ${pct}%. Reviewers are approaching capacity limits. PRs may start queuing.`,
        metricValue: saturation,
        threshold,
        metadata: { activeReviewers: ctx.saturationData?.activeReviewers },
      };
    }
    return null;
  },
};

export const highRiskDeployed: AlertRule = {
  name: "high_risk_deployed",
  severity: "critical",
  channels: ["slack", "email", "pagerduty"],
  evaluate: (_ctx: EvaluationContext): AlertTrigger | null => {
    // This rule is triggered by deploy events, not by metrics
    // It's evaluated separately in the webhook worker
    return null;
  },
};

export const incidentAiAttributed: AlertRule = {
  name: "incident_ai_attributed",
  severity: "critical",
  channels: ["slack", "email", "pagerduty"],
  evaluate: (_ctx: EvaluationContext): AlertTrigger | null => {
    // This rule is triggered by incident creation, not by metrics
    // It's evaluated separately when incidents are created/updated
    return null;
  },
};

export const ALL_RULES: AlertRule[] = [
  aiCodeHigh,
  aiCodeCritical,
  verificationTaxSpike,
  verificationTaxAbsolute,
  reviewSaturationHigh,
  highRiskDeployed,
  incidentAiAttributed,
];

export const METRICS_RULES: AlertRule[] = [
  aiCodeHigh,
  aiCodeCritical,
  verificationTaxSpike,
  verificationTaxAbsolute,
  reviewSaturationHigh,
];
