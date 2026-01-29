export interface CommitData {
  sha: string;
  message: string;
  authorLogin: string;
  timestamp: Date;
  files: FileChange[];
  prNumber?: number;
  prBody?: string;
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface DetectionResult {
  confidence: number;
  method: "heuristic" | "ml_model" | "manual_override";
  signals: DetectionSignal[];
  riskTier: RiskTier;
  riskScore: number;
  explanation: string;
}

export interface DetectionSignal {
  name: string;
  weight: number;
  matched: boolean;
  detail?: string;
}

export type RiskTier = "T1_boilerplate" | "T2_glue" | "T3_core" | "T4_novel";
