import type { FileChange, DetectionSignal } from "../types";

const GENERIC_VAR_PATTERNS = [
  /const\s+(data|result|response|value|item|temp|tmp)\s*=/g,
  /let\s+(data|result|response|value|item|temp|tmp)\s*=/g,
  /function\s+(handleClick|handleChange|handleSubmit|getData|fetchData)\s*\(/g,
];

const EXCESSIVE_COMMENT_PATTERNS = [
  /\/\/\s*(TODO|FIXME|NOTE|HACK):/gi,
  /\/\/\s*.{50,}/g, // Very long inline comments
  /\/\*\*[\s\S]{200,}?\*\//g, // Long JSDoc blocks
];

const BOILERPLATE_INDICATORS = [
  /import\s+\{[^}]{100,}\}\s+from/g, // Large import blocks
  /export\s+(default\s+)?function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{10,50}\}/g, // Short exported functions
];

export function checkCodeStyle(
  file: FileChange,
  weight: number
): DetectionSignal {
  if (!file.patch) {
    return { name: "generic_style", weight: 0, matched: false };
  }

  const addedLines = file.patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");

  if (addedLines.length < 50) {
    return { name: "generic_style", weight: 0, matched: false };
  }

  let signals = 0;
  const details: string[] = [];

  // Check generic variable names
  for (const pattern of GENERIC_VAR_PATTERNS) {
    const matches = addedLines.match(pattern);
    if (matches && matches.length >= 2) {
      signals += 1;
      details.push("generic variable names");
      break;
    }
  }

  // Check excessive comments
  for (const pattern of EXCESSIVE_COMMENT_PATTERNS) {
    const matches = addedLines.match(pattern);
    if (matches && matches.length >= 3) {
      signals += 1;
      details.push("excessive comments");
      break;
    }
  }

  // Check boilerplate patterns
  for (const pattern of BOILERPLATE_INDICATORS) {
    if (pattern.test(addedLines)) {
      signals += 0.5;
      details.push("boilerplate patterns");
      break;
    }
  }

  if (signals >= 1.5) {
    return {
      name: "generic_style",
      weight: Math.min(weight, weight * (signals / 2)),
      matched: true,
      detail: details.join(", "),
    };
  }

  return { name: "generic_style", weight: 0, matched: false };
}
