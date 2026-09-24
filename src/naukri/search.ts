import { Page } from "playwright";
import { getLogger } from "../logging/logger";
import { detectSecurityChallenge } from "../browser/session";

/**
 * Builds a Naukri keyword search URL with a freshness filter. Selector/URL-
 * param fallbacks below are documented, not live-verified (see README "Known
 * limitations" — Phase 19 requires a real Naukri session to confirm).
 */
export function buildSearchUrl(keyword: string, maxAgeDays: number): string {
  const encoded = encodeURIComponent(keyword);
  const params = new URLSearchParams({
    k: keyword,
    nignbevent_src: "jobsearchDeskGNB",
  });
  if (maxAgeDays > 0) {
    params.set("jobAge", String(maxAgeDays));
  }
  return `https://www.naukri.com/${encoded.replace(/%20/g, "-").toLowerCase()}-jobs?${params.toString()}`;
}

const SORT_BY_DATE_SELECTORS = [
  "div[class*='sortBy'] >> text=Date",
  "button:has-text('Sort by')",
  "[data-filter-id='sort'] >> text=Date",
];

/** Best-effort UI sort-by-newest, with the URL `jobAge`/`k` params as the primary freshness signal. */
export async function sortByNewest(page: Page): Promise<void> {
  for (const selector of SORT_BY_DATE_SELECTORS) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => undefined);
      await page.waitForTimeout(500);
      return;
    }
  }
  getLogger().warn({ event: "SORT_BY_DATE_CONTROL_NOT_FOUND" });
}

export async function runSearch(page: Page, keyword: string, maxAgeDays: number): Promise<void> {
  const url = buildSearchUrl(keyword, maxAgeDays);
  getLogger().info({ event: "SEARCH_STARTED", keyword, url });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Search pages previously had no challenge check at all, so a CAPTCHA/
  // interstitial here would silently hang instead of being logged (Phase 12).
  await detectSecurityChallenge(page);
  await sortByNewest(page);
}
