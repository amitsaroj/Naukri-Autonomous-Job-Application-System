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
 * redirect, upload resume, answer the questionnaire (blocking on unknown
 * mandatory questions, Phase 9), and submit — unless dryRun, per Phase 13,
 * in which case it inspects the flow but never clicks the final submit.
 * Selector chain is a fallback list, not live-verified (Phase 19).
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

    await applyButton.click();
    await page.waitForTimeout(800);
    await detectSecurityChallenge(page);

    const resumeUpload = await uploadResumeIfPrompted(page, resumePath);
    if (resumeUpload.attempted && !resumeUpload.success) {
      const screenshotPath = await saveScreenshot(page, `resume_upload_failed_${job.jobId ?? "unknown"}`);
      return { status: "failed", error: "Resume upload was rejected by Naukri", screenshotPath };
    }

    const questionnaireOutcome = await handleQuestionnaire(page, profile, dryRun);
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

    if (dryRun) {
      logEvent("DRY_RUN_APPLICATION_INSPECTED", {
        jobId: job.jobId,
        title: job.title,
        company: job.company,
        url: job.url,
        answeredQuestions: questionnaireOutcome.answeredQuestions,
      });
      return { status: "dry_run" };
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
