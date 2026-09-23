import { Page } from "playwright";

export interface JobListing {
  jobId: string | null;
  title: string;
  company: string;
  location: string;
  url: string;
  postedLabel: string;
  postedDaysAgo: number | null;
  searchKeyword: string;
}

export interface JobDetail extends JobListing {
  description: string;
  experienceLabel: string;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  salaryLabel: string | null;
  skills: string[];
  workMode: "remote" | "hybrid" | "onsite" | "unknown";
  employmentType: string | null;
}

/** Naukri job URLs carry a numeric id as the last dash-separated URL segment, e.g. .../job-listings-123456789 */
export function extractJobId(url: string): string | null {
  const match = url.match(/(\d{6,})(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

export function canonicalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export function normalizeCompanyTitle(company: string, title: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${clean(company)}::${clean(title)}`;
}

/** Parses Naukri's relative posted-date text ("2 days ago", "few hours ago", "Today"). */
export function parsePostedDaysAgo(label: string): number | null {
  const text = label.trim().toLowerCase();
  if (!text) return null;
  if (/today|just now|few (hours|minutes) ago|hours? ago|minutes? ago/.test(text)) return 0;
  const daysMatch = text.match(/(\d+)\s*day/);
  if (daysMatch?.[1]) return parseInt(daysMatch[1], 10);
  const weekMatch = text.match(/(\d+)\s*week/);
  if (weekMatch?.[1]) return parseInt(weekMatch[1], 10) * 7;
  const monthMatch = text.match(/(\d+)\s*month/);
  if (monthMatch?.[1]) return parseInt(monthMatch[1], 10) * 30;
  return null;
}

const WORK_MODE_PATTERNS: Array<[RegExp, JobDetail["workMode"]]> = [
  [/work from home|remote/i, "remote"],
  [/hybrid/i, "hybrid"],
];

function detectWorkMode(text: string): JobDetail["workMode"] {
  for (const [pattern, mode] of WORK_MODE_PATTERNS) {
    if (pattern.test(text)) return mode;
  }
  return "onsite";
}

/**
 * Navigates to the job's detail page and extracts structured details.
 * Selectors verified live 2026-09-23 against a real authenticated Naukri
 * session (Phase 19). Owns its own navigation so callers can't accidentally
 * parse the wrong page (a search-results page previously produced empty
 * description/skills for every job, silently zeroing the technologies score
 * component).
 */
export async function parseJobDetail(page: Page, listing: JobListing): Promise<JobDetail> {
  await page.goto(listing.url, { waitUntil: "domcontentloaded" });
  await page
    .locator("[class*='job-desc'], [class*='JDC__dang-inner-html']")
    .first()
    .waitFor({ state: "attached", timeout: 10_000 })
    .catch(() => undefined);

  const description = await firstText(page, [
    "[class*='job-desc']",
    "section.styles_job-desc-container__",
    "div[class*='JDC__dang-inner-html']",
    "article",
  ]);

  const experienceLabel = await firstText(page, [
    "[class*='exp']",
    "span[class*='experience']",
    "[class*='salary'] + span",
  ]);
  const expMatch = experienceLabel.match(/(\d+)\s*-\s*(\d+)\s*Yrs?/i) ?? experienceLabel.match(/(\d+)\+?\s*Yrs?/i);
  const minExperienceYears = expMatch?.[1] ? parseInt(expMatch[1], 10) : null;
  const maxExperienceYears = expMatch?.[2] ? parseInt(expMatch[2], 10) : minExperienceYears;

  const salaryLabel = (await firstText(page, ["[class*='salary']"])) || null;

  const skillsLocator = page.locator(
    "[class*='key-skill'] a, [class*='chip'][class*='skill'], a[class*='chip']"
  );
  const skills = await skillsLocator
    .allTextContents()
    .then((arr) => arr.map((s) => s.trim()).filter(Boolean))
    .catch(() => [] as string[]);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const employmentType = /full[\s-]?time/i.test(bodyText)
    ? "Full-time"
    : /part[\s-]?time/i.test(bodyText)
    ? "Part-time"
    : /contract/i.test(bodyText)
    ? "Contract"
    : null;

  return {
    ...listing,
    description,
    experienceLabel,
    minExperienceYears,
    maxExperienceYears,
    salaryLabel,
    skills,
    workMode: detectWorkMode(bodyText),
    employmentType,
  };
}

export async function firstText(page: Page, selectors: string[]): Promise<string> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const text = await locator.innerText().catch(() => null);
    if (text && text.trim().length > 0) return text.trim();
  }
  return "";
}
