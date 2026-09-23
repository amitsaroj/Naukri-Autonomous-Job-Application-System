import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";
import { loadConfig } from "../config/config";

const patternSchema = z.object({
  id: z.string(),
  patterns: z.array(z.string()),
  factPath: z.string(),
  formatAs: z.enum(["raw", "years", "ctc_lpa", "ctc_range", "notice_period_days"]),
});

export type QuestionPattern = z.infer<typeof patternSchema>;

let cached: QuestionPattern[] | undefined;

export function loadQuestionPatterns(): QuestionPattern[] {
  if (cached) return cached;
  const config = loadConfig();
  const raw = readFileSync(path.resolve(config.QUESTION_PATTERNS_PATH), "utf-8");
  cached = z.array(patternSchema).parse(JSON.parse(raw));
  return cached;
}

/** Pure keyword match against known question phrasings — never guesses at intent (Phase 9). */
export function matchQuestion(questionText: string): QuestionPattern | null {
  const normalized = questionText.toLowerCase();
  const patterns = loadQuestionPatterns();
  for (const pattern of patterns) {
    if (pattern.patterns.some((p) => normalized.includes(p.toLowerCase()))) {
      return pattern;
    }
  }
  return null;
}
