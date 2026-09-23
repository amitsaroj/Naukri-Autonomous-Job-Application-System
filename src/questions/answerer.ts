import { CandidateProfile, getProfileFact } from "../profile/profile";
import { matchQuestion, QuestionPattern } from "./matcher";
import { logEvent } from "../logging/logger";

export interface AnswerResult {
  answered: boolean;
  answer: string | null;
  matchedPatternId: string | null;
  blockReason: string | null;
}

function formatAnswer(fact: unknown, formatAs: QuestionPattern["formatAs"], profile: CandidateProfile): string {
  switch (formatAs) {
    case "years":
      return String(fact);
    case "ctc_lpa":
      return `${fact} LPA`;
    case "ctc_range":
      return `${profile.expectedCtcMinLpa}-${profile.expectedCtcMaxLpa} LPA`;
    case "notice_period_days":
      return `${fact} days`;
    case "raw":
    default:
      return String(fact);
  }
}

/**
 * Answers a screening question strictly from verified profile facts.
 * Never fabricates years of experience, certifications, degrees, employment
 * history, visa/authorization status, relocation willingness, skills,
 * salary, or achievements (Phase 9). An unmatched or unknown-fact mandatory
 * question blocks the application instead of guessing.
 */
export function answerQuestion(questionText: string, profile: CandidateProfile, isMandatory: boolean): AnswerResult {
  const pattern = matchQuestion(questionText);

  if (!pattern) {
    logEvent("QUESTION_UNANSWERABLE", { questionText, reason: "no_pattern_match", isMandatory });
    return {
      answered: false,
      answer: null,
      matchedPatternId: null,
      blockReason: isMandatory ? "No known pattern matches this mandatory question." : null,
    };
  }

  const fact = getProfileFact(profile, pattern.factPath);
  if (fact === undefined || fact === null || fact === "") {
    logEvent("QUESTION_UNANSWERABLE", {
      questionText,
      matchedPatternId: pattern.id,
      reason: "fact_unknown",
      isMandatory,
    });
    return {
      answered: false,
      answer: null,
      matchedPatternId: pattern.id,
      blockReason: isMandatory
        ? `Matched question "${pattern.id}" but the required profile fact "${pattern.factPath}" is unknown.`
        : null,
    };
  }

  const answer = formatAnswer(fact, pattern.formatAs, profile);
  return { answered: true, answer, matchedPatternId: pattern.id, blockReason: null };
}
