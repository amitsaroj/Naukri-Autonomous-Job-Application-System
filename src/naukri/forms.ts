import { Page } from "playwright";
import { CandidateProfile } from "../profile/profile";
import { answerQuestion } from "../questions/answerer";
import { getLogger, logEvent } from "../logging/logger";

export interface QuestionnaireOutcome {
  allAnswered: boolean;
  blockedQuestion: string | null;
  answeredQuestions: Array<{ question: string; answer: string }>;
}

const QUESTIONNAIRE_CONTAINER_SELECTORS = [
  "[class*='chatbot_modal']",
  "[class*='chatbot_DrawerContentWrapper']",
  "[class*='apply-message']",
  "[class*='drawer']",
];
const QUESTION_TEXT_SELECTORS = ["[class*='botMsg']", "[class*='question']", "label"];
const RADIO_OPTION_SELECTORS = "[class*='radio'] input[type='radio'], input[type='radio']";
const DROPDOWN_SELECTORS = "select, [role='combobox']";
const TEXT_INPUT_SELECTORS = "input[type='text'], input[type='number'], textarea, [contenteditable='true']";
const SUBMIT_BUTTON_SELECTORS = "button:has-text('Save'), button:has-text('Submit'), button[type='submit']";

async function findVisible(page: Page, selectors: string) {
  const locator = page.locator(selectors);
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const el = locator.nth(i);
    if (await el.isVisible().catch(() => false)) return el;
  }
  return null;
}

/**
 * Polls Naukri's screening-question flow (chatbot-style, one question per
 * step) and answers strictly from verified profile facts. Stops and reports
 * a block on the first mandatory question it can't answer (Phase 9) — never
 * guesses. Selector chain is a fallback list, not live-verified (Phase 19).
 */
export async function handleQuestionnaire(
  page: Page,
  profile: CandidateProfile,
  dryRun: boolean,
  maxIterations = 40
): Promise<QuestionnaireOutcome> {
  const answeredQuestions: Array<{ question: string; answer: string }> = [];

  for (let i = 0; i < maxIterations; i++) {
    const container = await findVisible(page, QUESTIONNAIRE_CONTAINER_SELECTORS.join(", "));
    if (!container) break;

    const questionEl = await findVisible(page, QUESTION_TEXT_SELECTORS.join(", "));
    const questionText = (await questionEl?.innerText().catch(() => "")) ?? "";
    if (!questionText.trim()) break;

    const result = answerQuestion(questionText, profile, true);
    if (!result.answered || !result.answer) {
      logEvent("QUESTIONNAIRE_BLOCKED", { questionText });
      return { allAnswered: false, blockedQuestion: questionText, answeredQuestions };
    }

    if (dryRun) {
      answeredQuestions.push({ question: questionText, answer: result.answer });
      logEvent("DRY_RUN_QUESTION_ANSWER_IDENTIFIED", { questionText, answer: result.answer });
      break; // dry-run inspects one round-trip; does not drive the chatbot forward
    }

    const filled = await fillAnswer(page, result.answer);
    if (!filled) {
      logEvent("QUESTIONNAIRE_FIELD_FILL_FAILED", { questionText });
      return { allAnswered: false, blockedQuestion: questionText, answeredQuestions };
    }
    answeredQuestions.push({ question: questionText, answer: result.answer });

    const submit = await findVisible(page, SUBMIT_BUTTON_SELECTORS);
    await submit?.click().catch(() => undefined);
    await page.waitForTimeout(600);
  }

  return { allAnswered: true, blockedQuestion: null, answeredQuestions };
}

async function fillAnswer(page: Page, answer: string): Promise<boolean> {
  const radio = await findVisible(page, RADIO_OPTION_SELECTORS);
  if (radio) {
    await radio.check().catch(() => undefined);
    return true;
  }

  const dropdown = await findVisible(page, DROPDOWN_SELECTORS);
  if (dropdown) {
    await dropdown.click().catch(() => undefined);
    const option = page.locator(`[role='option']:has-text("${answer}"), option:has-text("${answer}")`).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click().catch(() => undefined);
      return true;
    }
  }

  const textInput = await findVisible(page, TEXT_INPUT_SELECTORS);
  if (textInput) {
    await textInput.fill(answer).catch(async () => {
      await textInput.type(answer).catch(() => undefined);
    });
    return true;
  }

  return false;
}

/** Uploads the resume when Easy Apply exposes a file input; otherwise the existing profile resume is reused. */
export async function uploadResumeIfPrompted(page: Page, resumePath: string): Promise<boolean> {
  const fileInput = page.locator("input[type='file']").first();
  const present = (await fileInput.count().catch(() => 0)) > 0;
  if (!present) return false;
  await fileInput.setInputFiles(resumePath);
  getLogger().info({ event: "RESUME_UPLOADED", resumePath });
  return true;
}
