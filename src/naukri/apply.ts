import { Page } from "playwright";
import { JobDetail } from "./parser";
import { CandidateProfile } from "../profile/profile";
import { handleQuestionnaire, uploadResumeIfPrompted } from "./forms";
import { detectSecurityChallenge } from "../browser/session";
import { ApplicationTracker } from "../applications/tracker";
import { saveScreenshot } from "../browser/browser";
import { getLogger, logEvent } from "../logging/logger";

export type ApplyStatus =
  | "applied"
  | "dry_run"
  | "skipped_external"
  | "skipped_question_blocked"
  | "failed";

export interface ApplyOutcome {
  status: ApplyStatus;
  blockedQuestion?: string;
  error?: string;
  screenshotPath?: string;
}

const APPLY_BUTTON_SELECTORS = [
  "#apply-button",
  "button:has-text('Apply')",
  "button:has-text('Easy Apply')",
];
const COMPANY_SITE_SELECTORS = [
  "#company-site-button",
  "button:has-text('Company site')",
  "a:has-text('Apply on company site')",
];
const SUCCESS_MARKER_SELECTORS = [
  "text=/application sent|applied successfully|you have successfully applied/i",
];

/**
 * Runs the Easy-Apply flow for a single job: detect apply vs external
 * redirect, then either stop (dryRun — never clicks Apply at all; see the
 * CRITICAL comment below for why) or click through resume upload, answer
 * the questionnaire (blocking on unknown mandatory questions, Phase 9),
 * and submit for real.
 */
export async function applyToJob(
  page: Page,
  job: JobDetail,
  profile: CandidateProfile,
  resumePath: string,
  dryRun: boolean
): Promise<ApplyOutcome> {
  const logger = getLogger();
  try {
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await detectSecurityChallenge(page);
    // The apply/company-site button is client-rendered, so checking right
    // after domcontentloaded raced React's hydration and always reported
    // "not found" even when it existed (verified live 2026-09-24 — Phase 19).
    await page
      .locator([...APPLY_BUTTON_SELECTORS, ...COMPANY_SITE_SELECTORS].join(", "))
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .catch(() => undefined);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (ApplicationTracker.detectNaukriQuotaMessage(bodyText)) {
      throw new Error("NAUKRI_QUOTA_MESSAGE_DETECTED");
    }

    const isExternal = await isCompanySiteRedirect(page);
    if (isExternal) {
      logEvent("EXTERNAL_APPLICATION_SKIPPED", { url: job.url });
      return { status: "skipped_external" };
    }

    const applyButton = await firstVisible(page, APPLY_BUTTON_SELECTORS);
    if (!applyButton) {
      return { status: "failed", error: "Apply button not found (selector drift — Phase 19)" };
    }

    // CRITICAL (Phase 13): dry-run must stop here, before ever clicking
    // Apply. This code previously clicked Apply unconditionally and only
    // gated the *final* Submit click on dryRun, on the assumption that
    // Apply just opens a review drawer. That's false for jobs with no
    // follow-up questionnaire: clicking Apply there IS the full submission
    // on Naukri's side. Verified live 2026-09-24 the hard way — two "dry
    // run" inspections of questionnaire-less jobs turned out to be real,
    // already-submitted applications. Never repeat that: nothing past this
    // point may run when dryRun is true.
    if (dryRun) {
      logEvent("DRY_RUN_APPLICATION_INSPECTED", {
        jobId: job.jobId,
        title: job.title,
        company: job.company,
        url: job.url,
        note: "Apply button found; not clicked — dry-run cannot preview the questionnaire without risking a real submission.",
      });
      return { status: "dry_run" };
    }

    await applyButton.click();
    await page.waitForTimeout(800);
    await detectSecurityChallenge(page);

    // A failed fresh upload isn't fatal: verified live 2026-09-24 that a
    // resume is already on file on the Naukri profile (Easy Apply reuses it
    // silently for jobs that don't prompt for upload at all), so this widget
    // failing doesn't mean the application has no resume — just log and
    // continue rather than abandoning an otherwise-good application.
    const resumeUpload = await uploadResumeIfPrompted(page, resumePath);
    if (resumeUpload.attempted && !resumeUpload.success) {
      await saveScreenshot(page, `resume_upload_failed_${job.jobId ?? "unknown"}`);
      logEvent("RESUME_UPLOAD_FAILED_CONTINUING", { jobId: job.jobId, url: job.url });
    }

    // dryRun is always false past this point (guarded above), so the
    // questionnaire is always actually filled and saved, never previewed.
    const questionnaireOutcome = await handleQuestionnaire(page, profile);
    if (!questionnaireOutcome.allAnswered) {
      const screenshotPath = await saveScreenshot(page, `blocked_${job.jobId ?? "unknown"}`);
      logEvent("APPLICATION_BLOCKED", {
        jobId: job.jobId,
        url: job.url,
        reason: questionnaireOutcome.blockedQuestion,
      });
      return {
        status: "skipped_question_blocked",
        blockedQuestion: questionnaireOutcome.blockedQuestion ?? undefined,
        screenshotPath,
      };
    }

    const submitButton = await firstVisible(page, [
      "button:has-text('Submit')",
      "button:has-text('Send')",
      "button[type='submit']",
    ]);
    await submitButton?.click().catch(() => undefined);
    await page.waitForTimeout(1200);

    const success = await verifySubmission(page);
    if (!success) {
      const screenshotPath = await saveScreenshot(page, `unverified_${job.jobId ?? "unknown"}`);
      return { status: "failed", error: "Submission could not be verified", screenshotPath };
    }

    logEvent("APPLICATION_SUBMITTED", {
      jobId: job.jobId,
      company: job.company,
      title: job.title,
      url: job.url,
    });
    return { status: "applied" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ event: "APPLICATION_FAILED", jobId: job.jobId, url: job.url, error });
    const screenshotPath = await saveScreenshot(page, `failed_${job.jobId ?? "unknown"}`).catch(() => undefined);
    return { status: "failed", error, screenshotPath };
  }
}

async function isCompanySiteRedirect(page: Page): Promise<boolean> {
  for (const selector of COMPANY_SITE_SELECTORS) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
  }
  return false;
}

async function firstVisible(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) return el;
  }
  return null;
}

async function verifySubmission(page: Page): Promise<boolean> {
  for (const selector of SUCCESS_MARKER_SELECTORS) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
  }
  return false;
}
