export interface DateWindow {
  start: Date;
  end: Date;
}

export interface DailyMetricsResult {
  totalCommits: number;
  aiCommits: number;
  humanCommits: number;
  aiCodePercentage: number;
  avgReviewTimeMins: number;
  highRiskFileCount: number;
  incidentCount: number;
  verificationTaxHours: number;
}

export interface SurvivalCheckResult {
  checked: number;
  survived: number;
  failed: number;
  skipped: number;
}

export interface SaturationResult {
  activeReviewers: number;
  avgReviewTimeMins: number;
  prsPerDay: number;
  capacityPerDay: number;
  saturation: number;
  isHighSaturation: boolean;
}

export interface ComputeMetricsOptions {
  repoId: string;
  date: string;
}

export interface BackfillOptions {
  repoId?: string;
  startDate: string;
  endDate: string;
}
