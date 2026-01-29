import type { CommitData, DetectionSignal } from "../types";

export function checkTimeOfDay(
  commit: CommitData,
  weight: number
): DetectionSignal {
  const hour = commit.timestamp.getUTCHours();

  // 2am-4am UTC is suspicious for most developers
  // This is a weak signal - many devs work late
  if (hour >= 2 && hour <= 4) {
    return {
      name: "late_night",
      weight,
      matched: true,
      detail: `Commit at ${hour}:00 UTC`,
    };
  }

  return { name: "late_night", weight: 0, matched: false };
}
