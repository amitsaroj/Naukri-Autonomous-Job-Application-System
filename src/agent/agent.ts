import { AppConfig } from "../config/config";
import { CandidateProfile } from "../profile/profile";
import { getPage, closeBrowserContext } from "../browser/browser";
import { ensureAuthenticated, SecurityChallengeError } from "../browser/session";
import { runSearch } from "../naukri/search";
import { scrapeJobCards, filterByFreshness } from "../naukri/jobs";
import { parseJobDetail } from "../naukri/parser";
import { scoreJob } from "../matching/scorer";
import { applyToJob } from "../naukri/apply";
import { findExistingApplication, recordApplication } from "../applications/repository";
import { ApplicationTracker, DailyLimitReachedError, NaukriQuotaReachedError } from "../applications/tracker";
import { resolveResumePath } from "../profile/resume";
import { getLogger, logEvent } from "../logging/logger";

export interface AgentRunSummary {
  keywordsSearched: number;
  jobsCollected: number;
  jobsDeduped: number;
  jobsScored: number;
  jobsRejectedByScore: number;
  applied: number;
  dryRun: number;
  blockedByQuestions: number;
  skippedExternal: number;
  failed: number;
}

/**
 * Runs the full Phase-5 workflow: authenticate -> search each keyword ->
 * sort newest -> collect -> extract -> dedupe -> score -> reject unsuitable
 * -> apply to qualifying jobs -> track -> continue, respecting daily/run
 * limits and randomized delays throughout.
 */
export async function runAgent(
  config: AppConfig,
  profile: CandidateProfile
): Promise<AgentRunSummary> {
  const logger = getLogger();
  const summary: AgentRunSummary = {
    keywordsSearched: 0,
    jobsCollected: 0,
    jobsDeduped: 0,
    jobsScored: 0,
    jobsRejectedByScore: 0,
    applied: 0,
    dryRun: 0,
    blockedByQuestions: 0,
    skippedExternal: 0,
    failed: 0,
  };

  const resumePath = resolveResumePath();
  const tracker = new ApplicationTracker(config);
  const page = await getPage();

  try {
    await ensureAuthenticated(page);

    for (const keyword of config.searchKeywords) {
      summary.keywordsSearched += 1;
      try {
        tracker.assertCanApplyMore();
      } catch (err) {
        if (err instanceof DailyLimitReachedError) {
          logger.warn({ event: "STOPPING_RUN", reason: err.message });
          break;
        }
        throw err;
      }

      if (summary.keywordsSearched > 1) {
        // Back-to-back automated searches with zero pacing look bot-like to
        // Naukri; only application submissions had a delay before (Phase 11
        // is about not hammering the site generally, not just on submit).
        const delayMs = 3000 + Math.round(Math.random() * 4000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      await runSearch(page, keyword, config.MAX_JOB_AGE_DAYS);
      const rawListings = await scrapeJobCards(page, keyword);
      const freshListings = filterByFreshness(rawListings, config.MAX_JOB_AGE_DAYS)
        // Naukri's own "Sort by: Date" UI control has never been reliably
        // found by selector (Phase 19), so enforce newest-first ourselves
        // instead of trusting the page's default (relevance) ordering.
        .sort((a, b) => (a.postedDaysAgo ?? 999) - (b.postedDaysAgo ?? 999));
      summary.jobsCollected += freshListings.length;

      for (const listing of freshListings) {
        try {
          tracker.assertCanApplyMore();
        } catch (err) {
          if (err instanceof DailyLimitReachedError) {
            logger.warn({ event: "STOPPING_RUN", reason: err.message });
            return summary;
          }
          throw err;
        }

        const existing = findExistingApplication(listing);
        if (existing) {
          summary.jobsDeduped += 1;
          logEvent("DUPLICATE_SKIPPED", { url: listing.url, existingStatus: existing.application_status });
          continue;
        }

        const detail = await parseJobDetail(page, listing).catch((err) => {
          logger.warn({ event: "JOB_DETAIL_PARSE_FAILED", url: listing.url, error: String(err) });
          return null;
        });
        if (!detail) continue;

        const match = scoreJob(detail, profile);
        summary.jobsScored += 1;

        if (match.vetoed || match.score < config.MIN_MATCH_SCORE) {
          summary.jobsRejectedByScore += 1;
          recordApplication({
            job: listing,
            matchScore: match.score,
            status: "skipped_low_score",
          });
          logEvent("JOB_REJECTED", { url: listing.url, score: match.score, reason: match.vetoReason });
          continue;
        }

        const outcome = await applyToJob(page, detail, profile, resumePath, config.DRY_RUN);
        await recordOutcome(listing, match.score, outcome, summary);

        if (outcome.status === "applied") {
          tracker.recordSuccess();
        }
        if (outcome.status === "applied" || outcome.status === "dry_run") {
          await tracker.waitBetweenApplications();
        }
      }
    }
  } catch (err) {
    if (err instanceof SecurityChallengeError) {
      logger.warn({ event: "RUN_PAUSED_SECURITY_CHALLENGE", kind: err.kind });
    } else if (err instanceof NaukriQuotaReachedError) {
      logger.warn({ event: "RUN_STOPPED_NAUKRI_QUOTA" });
    } else {
      throw err;
    }
  } finally {
    await closeBrowserContext();
  }

  return summary;
}

async function recordOutcome(
  listing: Parameters<typeof recordApplication>[0]["job"],
  score: number,
  outcome: Awaited<ReturnType<typeof applyToJob>>,
  summary: AgentRunSummary
): Promise<void> {
  const statusMap = {
    applied: "applied",
    dry_run: "dry_run",
    skipped_external: "skipped_external",
    skipped_question_blocked: "skipped_question_blocked",
    failed: "failed",
  } as const;

  recordApplication({
    job: listing,
    matchScore: score,
    status: statusMap[outcome.status],
    error: outcome.error ?? null,
  });

  if (outcome.status === "applied") summary.applied += 1;
  if (outcome.status === "dry_run") summary.dryRun += 1;
  if (outcome.status === "skipped_question_blocked") summary.blockedByQuestions += 1;
  if (outcome.status === "skipped_external") summary.skippedExternal += 1;
  if (outcome.status === "failed") summary.failed += 1;
}
