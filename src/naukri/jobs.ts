import { Locator, Page } from "playwright";
import { JobListing, extractJobId, parsePostedDaysAgo } from "./parser";
import { getLogger } from "../logging/logger";

const JOB_CARD_SELECTORS = [
  "div.srp-jobtuple-wrapper",
  "article.jobTuple",
  "div[class*='jobTuple']",
];
const TITLE_LINK_SELECTORS = ["a.title", "a[class*='title']", "a[class*='ellipsis']"];
const COMPANY_SELECTORS = ["a.comp-name", "span.comp-name", "[class*='companyName']"];
const LOCATION_SELECTORS = ["span.locWdth", "[class*='location']", "span[title]"];
const POSTED_SELECTORS = ["span.job-post-day", "[class*='postedDate']", "span[class*='fleft']"];

async function firstMatch(scope: Locator, selectors: string[]): Promise<string> {
  for (const selector of selectors) {
    const text = await scope.locator(selector).first().innerText().catch(() => null);
    if (text && text.trim()) return text.trim();
  }
  return "";
}

/**
 * Scrapes job cards from a Naukri search-results page using a fallback
 * selector chain (per Phase 19, requires live verification before real use).
 */
export async function scrapeJobCards(page: Page, searchKeyword: string): Promise<JobListing[]> {
  const cards = page.locator(JOB_CARD_SELECTORS.join(", "));
  const count = await cards.count();

  if (count === 0) {
    getLogger().warn({ event: "NO_JOB_CARDS_FOUND", searchKeyword, url: page.url() });
    return [];
  }

  const listings: JobListing[] = [];
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);

    const titleLink = card.locator(TITLE_LINK_SELECTORS.join(", ")).first();
    const title = (await titleLink.innerText().catch(() => ""))?.trim();
    const url = (await titleLink.getAttribute("href").catch(() => null)) ?? "";
    if (!title || !url) continue;

    const company = (await firstMatch(card, COMPANY_SELECTORS)) || "Unknown";
    const location = (await firstMatch(card, LOCATION_SELECTORS)) || "";
    const postedLabel = (await firstMatch(card, POSTED_SELECTORS)) || "";

    listings.push({
      jobId: extractJobId(url),
      title,
      company,
      location,
      url: url.startsWith("http") ? url : `https://www.naukri.com${url}`,
      postedLabel,
      postedDaysAgo: parsePostedDaysAgo(postedLabel),
      searchKeyword,
    });
  }

  getLogger().info({ event: "JOB_CARDS_SCRAPED", searchKeyword, count: listings.length });
  return listings;
}

export function filterByFreshness(listings: JobListing[], maxAgeDays: number): JobListing[] {
  return listings.filter((job) => job.postedDaysAgo === null || job.postedDaysAgo <= maxAgeDays);
}
