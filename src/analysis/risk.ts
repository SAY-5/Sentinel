import type { CommitData, RiskTier } from "./types";

const CORE_PATH_PATTERNS = [
  /auth/i,
  /payment/i,
  /billing/i,
  /security/i,
  /crypto/i,
  /password/i,
  /session/i,
  /token/i,
  /middleware/i,
  /api\/.*\.(ts|js)$/,
];

const BOILERPLATE_PATTERNS = [
  /\.config\.(ts|js|mjs|cjs)$/,
  /\.test\.(ts|js|tsx|jsx)$/,
  /\.spec\.(ts|js|tsx|jsx)$/,
  /types\.ts$/,
  /index\.ts$/,
  /\.d\.ts$/,
  /\.stories\.(ts|tsx)$/,
  /\.mock\.(ts|js)$/,
];

export function classifyRisk(
  commit: CommitData,
  aiConfidence: number
): { tier: RiskTier; score: number; explanation: string } {
  const paths = commit.files.map((f) => f.path);

  const touchesCore = paths.some((p) =>
    CORE_PATH_PATTERNS.some((pat) => pat.test(p))
  );

  const onlyBoilerplate = paths.every((p) =>
    BOILERPLATE_PATTERNS.some((pat) => pat.test(p))
  );

  let tier: RiskTier;
  let explanation: string;

  if (onlyBoilerplate) {
    tier = "T1_boilerplate";
    explanation = "Config, test, or type definition files only";
  } else if (touchesCore && aiConfidence > 0.7) {
    tier = "T4_novel";
    explanation = "High-confidence AI in security-sensitive code";
  } else if (touchesCore) {
    tier = "T3_core";
    explanation = "Changes to core business logic";
  } else {
    tier = "T2_glue";
    explanation = "Standard application code";
  }

  // Downgrade risk tier for low AI confidence
  if (aiConfidence < 0.3) {
    if (tier === "T4_novel") {
      tier = "T3_core";
      explanation += " (low AI confidence, downgraded)";
    } else if (tier === "T3_core") {
      tier = "T2_glue";
      explanation += " (low AI confidence, downgraded)";
    }
  }

  // Risk score combines AI confidence + blast radius
  const blastRadius = touchesCore ? 0.3 : 0.1;
  const score = Math.min(1.0, aiConfidence * 0.7 + blastRadius);

  return { tier, score, explanation };
}
