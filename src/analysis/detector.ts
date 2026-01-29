import type { CommitData, DetectionResult, DetectionSignal } from "./types";
import { checkCopilotCoauthor } from "./signals/commit-message";
import { checkPRMentionsAI } from "./signals/pr-mentions";
import { checkVelocity } from "./signals/velocity";
import { checkTimeOfDay } from "./signals/time-of-day";
import { checkCodeStyle } from "./signals/style";
import { classifyRisk } from "./risk";

const WEIGHTS = {
  copilot_coauthor: 0.9,
  pr_mentions_ai: 0.7,
  high_velocity: 0.6,
  late_night: 0.3,
  generic_style: 0.4,
} as const;

export async function detectAI(commit: CommitData): Promise<DetectionResult> {
  const signals: DetectionSignal[] = [];

  // Commit message signals (definitive when present)
  signals.push(checkCopilotCoauthor(commit, WEIGHTS.copilot_coauthor));

  // PR body signals
  signals.push(checkPRMentionsAI(commit, WEIGHTS.pr_mentions_ai));

  // Velocity signals
  signals.push(checkVelocity(commit, WEIGHTS.high_velocity));

  // Time of day (weak signal)
  signals.push(checkTimeOfDay(commit, WEIGHTS.late_night));

  // Code style analysis per file
  for (const file of commit.files) {
    if (file.patch) {
      const styleSignal = checkCodeStyle(file, WEIGHTS.generic_style);
      if (styleSignal.matched) {
        signals.push({
          ...styleSignal,
          detail: `${file.path}: ${styleSignal.detail}`,
        });
      }
    }
  }

  // Calculate weighted confidence
  const matchedSignals = signals.filter((s) => s.matched);
  const confidence = Math.min(
    1.0,
    matchedSignals.reduce((sum, s) => sum + s.weight, 0)
  );

  const { tier, score, explanation } = classifyRisk(commit, confidence);

  return {
    confidence,
    method: "heuristic",
    signals,
    riskTier: tier,
    riskScore: score,
    explanation,
  };
}
