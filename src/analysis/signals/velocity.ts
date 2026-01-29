import type { CommitData, DetectionSignal } from "../types";

const HIGH_VELOCITY_THRESHOLD = 500;
const VERY_HIGH_VELOCITY_THRESHOLD = 1000;

export function checkVelocity(
  commit: CommitData,
  weight: number
): DetectionSignal {
  const totalLines = commit.files.reduce(
    (sum, f) => sum + f.additions + f.deletions,
    0
  );

  if (totalLines >= VERY_HIGH_VELOCITY_THRESHOLD) {
    return {
      name: "high_velocity",
      weight,
      matched: true,
      detail: `${totalLines} lines changed (very high)`,
    };
  }

  if (totalLines >= HIGH_VELOCITY_THRESHOLD) {
    return {
      name: "high_velocity",
      weight: weight * 0.6,
      matched: true,
      detail: `${totalLines} lines changed`,
    };
  }

  return { name: "high_velocity", weight: 0, matched: false };
}
