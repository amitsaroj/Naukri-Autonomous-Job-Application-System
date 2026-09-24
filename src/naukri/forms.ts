import { Locator, Page } from "playwright";
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

async function findVisible(scope: Page | Locator, selectors: string) {
  const locator = scope.locator(selectors);
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const el = locator.nth(i);
    if (await el.isVisible().catch(() => false)) return el;
  }
  return null;
}

/**
 * Polls Naukri's screening-question flow (chatbot-style, one question per
 * step) and answers strictly from verified profile facts, actually filling
 * and saving each answer. Stops and reports a block on the first mandatory
 * question it can't answer (Phase 9) — never guesses. Only ever called for
 * a real (non-dry-run) application — the caller must never reach this after
 * an Apply click made in dry-run mode (Phase 13; see apply.ts).
 */
export async function handleQuestionnaire(
  page: Page,
  profile: CandidateProfile,
  maxIterations = 40
): Promise<QuestionnaireOutcome> {
  const answeredQuestions: Array<{ question: string; answer: string }> = [];

  for (let i = 0; i < maxIterations; i++) {
    // Wait (don't just instant-check) for the drawer — it can still be
    // rendering right after an Apply click or a resume-upload round trip
    // (verified live 2026-09-24: an instant check here previously raced
    // the drawer's own re-render and silently reported "no questionnaire").
    const containerLocator = page.locator(QUESTIONNAIRE_CONTAINER_SELECTORS.join(", ")).first();
    const containerAppeared = await containerLocator
      .waitFor({ state: "visible", timeout: 6_000 })
      .then(() => true)
      .catch(() => false);
    if (!containerAppeared) break; // Genuinely no (more) questionnaire steps for this job.
    const container = containerLocator;

    // Scoped to the questionnaire container — searching the whole page
    // previously matched an unrelated element elsewhere (e.g. a "Posted: "
    // label) instead of the actual bot question (verified live 2026-09-24).
    // Chat transcripts keep prior messages visible, so take the LAST
    // matching message (the current question), not the first.
    const botMessages = container.locator(QUESTION_TEXT_SELECTORS.join(", "));
    const botMessageCount = await botMessages.count();
    const questionEl = botMessageCount > 0 ? botMessages.nth(botMessageCount - 1) : null;
    const questionText = (await questionEl?.innerText().catch(() => "")) ?? "";
    if (!questionText.trim()) {
      // The drawer IS open but we couldn't identify the current question -
      // a parsing gap, not "done". Never silently treat this as answered.
      logEvent("QUESTIONNAIRE_BLOCKED", { questionText: "", reason: "question_text_not_found" });
      return { allAnswered: false, blockedQuestion: "(unrecognized questionnaire state)", answeredQuestions };
    }

    const result = answerQuestion(questionText, profile, true);
    if (!result.answered || !result.answer) {
      logEvent("QUESTIONNAIRE_BLOCKED", { questionText });
      return { allAnswered: false, blockedQuestion: questionText, answeredQuestions };
    }

    const filled = await fillAnswer(container, result.answer);
    if (!filled) {
      logEvent("QUESTIONNAIRE_FIELD_FILL_FAILED", { questionText });
      return { allAnswered: false, blockedQuestion: questionText, answeredQuestions };
    }
    answeredQuestions.push({ question: questionText, answer: result.answer });

    const submit = await findVisible(container, SUBMIT_BUTTON_SELECTORS);
    await submit?.click().catch(() => undefined);
    await page.waitForTimeout(600);
  }

  return { allAnswered: true, blockedQuestion: null, answeredQuestions };
}

async function fillAnswer(container: Locator, answer: string): Promise<boolean> {
  const radio = await findVisible(container, RADIO_OPTION_SELECTORS);
  if (radio) {
    await radio.check().catch(() => undefined);
    return true;
  }

  const dropdown = await findVisible(container, DROPDOWN_SELECTORS);
  if (dropdown) {
    await dropdown.click().catch(() => undefined);
    // The options list itself is typically rendered outside the drawer
    // container (as a page-level popover), so this lookup stays page-wide.
    const page = container.page();
    const option = page.locator(`[role='option']:has-text("${answer}"), option:has-text("${answer}")`).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click().catch(() => undefined);
      return true;
    }
  }

  const textInput = await findVisible(container, TEXT_INPUT_SELECTORS);
  if (textInput) {
    await textInput.fill(answer).catch(async () => {
      await textInput.type(answer).catch(() => undefined);
    });
    return true;
  }

  return false;
}

export interface ResumeUploadResult {
  attempted: boolean;
  success: boolean;
}

/**
 * Uploads the resume when Easy Apply exposes a file input; otherwise the
 * existing profile resume is reused. Verifies Naukri's own upload-validation
 * feedback rather than assuming success from setInputFiles() alone — a real
 * run previously logged RESUME_UPLOADED while Naukri's UI showed "File
 * upload was unsuccessful" for both attempts (verified live 2026-09-24).
 */
export async function uploadResumeIfPrompted(page: Page, resumePath: string): Promise<ResumeUploadResult> {
  const fileInput = page.locator("input[type='file']").first();
  const present = (await fileInput.count().catch(() => 0)) > 0;
  if (!present) return { attempted: false, success: true };

  await fileInput.setInputFiles(resumePath);
  await page.waitForTimeout(1500);

  const failureVisible = await page
    .locator("text=/file upload was unsuccessful|upload.*(fail|unsuccessful)/i")
    .first()
    .isVisible()
    .catch(() => false);
  if (failureVisible) {
    getLogger().warn({ event: "RESUME_UPLOAD_FAILED", resumePath });
    return { attempted: true, success: false };
  }

  getLogger().info({ event: "RESUME_UPLOADED", resumePath });
  return { attempted: true, success: true };
}
