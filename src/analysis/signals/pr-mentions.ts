import type { CommitData, DetectionSignal } from "../types";

const AI_TOOL_PATTERNS = [
  { pattern: /copilot/i, tool: "Copilot" },
  { pattern: /cursor/i, tool: "Cursor" },
  { pattern: /claude/i, tool: "Claude" },
  { pattern: /chatgpt/i, tool: "ChatGPT" },
  { pattern: /gpt-4/i, tool: "GPT-4" },
  { pattern: /gemini/i, tool: "Gemini" },
  { pattern: /codewhisperer/i, tool: "CodeWhisperer" },
  { pattern: /tabnine/i, tool: "Tabnine" },
  { pattern: /ai.assist/i, tool: "AI assist" },
  { pattern: /generated.*code/i, tool: "generated code mention" },
];

export function checkPRMentionsAI(
  commit: CommitData,
  weight: number
): DetectionSignal {
  if (!commit.prBody) {
    return { name: "pr_mentions_ai", weight: 0, matched: false };
  }

  const found: string[] = [];

  for (const { pattern, tool } of AI_TOOL_PATTERNS) {
    if (pattern.test(commit.prBody)) {
      found.push(tool);
    }
  }

  if (found.length > 0) {
    return {
      name: "pr_mentions_ai",
      weight: Math.min(weight, weight * (0.5 + found.length * 0.25)),
      matched: true,
      detail: `PR mentions: ${found.join(", ")}`,
    };
  }

  return { name: "pr_mentions_ai", weight: 0, matched: false };
}
