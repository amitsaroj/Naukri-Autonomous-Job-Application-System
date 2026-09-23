import { loadConfig } from "../config/config";
import { loadProfile } from "../profile/profile";
import { resolveResumePath } from "../profile/resume";
import { runAgent } from "../agent/agent";
import { getPage, closeBrowserContext } from "../browser/browser";
import { ensureAuthenticated, waitForManualLogin, AuthenticationRequiredError } from "../browser/session";
import { runSearch } from "../naukri/search";
import { scrapeJobCards, filterByFreshness } from "../naukri/jobs";
import { parseJobDetail } from "../naukri/parser";
import { scoreJob } from "../matching/scorer";
import { listApplications, getStats } from "../applications/repository";
import { getLogger } from "../logging/logger";

export async function loginCommand(): Promise<void> {
  const page = await getPage();
  await waitForManualLogin(page);
  await closeBrowserContext();
}

export async function agentCommand(opts: { dryRun?: boolean }): Promise<void> {
  const logger = getLogger();
  const config = loadConfig(opts.dryRun ? { DRY_RUN: true } : {});
  const profile = loadProfile();
  resolveResumePath();

  logger.info({ event: "AGENT_RUN_STARTED", dryRun: config.DRY_RUN, keywords: config.searchKeywords });
  const summary = await runAgent(config, profile);
  logger.info({ event: "AGENT_RUN_COMPLETE", summary });
  // eslint-disable-next-line no-console
  console.table(summary);
}

export async function searchCommand(): Promise<void> {
  const config = loadConfig();
  const profile = loadProfile();
  const page = await getPage();
  try {
    await ensureAuthenticated(page);
    for (const keyword of config.searchKeywords) {
      await runSearch(page, keyword, config.MAX_JOB_AGE_DAYS);
      const listings = filterByFreshness(await scrapeJobCards(page, keyword), config.MAX_JOB_AGE_DAYS);
      for (const listing of listings.slice(0, 10)) {
        const detail = await parseJobDetail(page, listing);
        const match = scoreJob(detail, profile);
        // eslint-disable-next-line no-console
        console.log(
          `[${match.score}] ${listing.title} @ ${listing.company} (${listing.location}) — ${
            match.vetoed ? `VETOED: ${match.vetoReason}` : match.reasons.join(", ")
          }`
        );
      }
    }
  } catch (err) {
    if (err instanceof AuthenticationRequiredError) {
      // eslint-disable-next-line no-console
      console.error("Naukri authentication required. Run `npm run login` first.");
      return;
    }
    throw err;
  } finally {
    await closeBrowserContext();
  }
}

export function applicationsCommand(): void {
  const rows = listApplications(50);
  // eslint-disable-next-line no-console
  console.table(
    rows.map((r) => ({
      id: r.id,
      title: r.job_title,
      company: r.company,
      status: r.application_status,
      score: r.match_score,
      date: r.application_date,
    }))
  );
}

export function statsCommand(): void {
  // eslint-disable-next-line no-console
  console.table(getStats());
}

export async function debugCommand(): Promise<void> {
  const config = loadConfig();
  const profile = loadProfile();
  // eslint-disable-next-line no-console
  console.log("Config:", { ...config, searchKeywords: `${config.searchKeywords.length} keywords` });
  // eslint-disable-next-line no-console
  console.log("Profile loaded for:", profile.name, "| resume:", resolveResumePath());

  const page = await getPage();
  try {
    await ensureAuthenticated(page);
    // eslint-disable-next-line no-console
    console.log("Naukri session: AUTHENTICATED");
  } catch (err) {
    if (err instanceof AuthenticationRequiredError) {
      // eslint-disable-next-line no-console
      console.log("Naukri session: NOT AUTHENTICATED — run `npm run login`");
    } else {
      throw err;
    }
  } finally {
    await closeBrowserContext();
  }
}
