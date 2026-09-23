import { getDatabase } from "../database/database";
import { JobListing } from "../naukri/parser";
import { canonicalizeJobUrl, normalizeCompanyTitle } from "../naukri/parser";

export type ApplicationStatus =
  | "pending"
  | "applied"
  | "skipped_low_score"
  | "skipped_duplicate"
  | "skipped_question_blocked"
  | "skipped_external"
  | "failed"
  | "dry_run";

export interface ApplicationRecord {
  id: number;
  job_id: string | null;
  job_url: string;
  canonical_url: string;
  job_title: string;
  company: string;
  normalized_company_title: string;
  location: string | null;
  posted_date: string | null;
  match_score: number | null;
  application_status: ApplicationStatus;
  application_date: string | null;
  resume: string | null;
  search_keyword: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewApplication {
  job: JobListing;
  matchScore: number | null;
  status: ApplicationStatus;
  resume?: string | null;
  error?: string | null;
}

/** Duplicate check using all three signals from Phase 10: job id, canonical URL, normalized company+title. */
export function findExistingApplication(job: JobListing): ApplicationRecord | undefined {
  const db = getDatabase();
  const canonicalUrl = canonicalizeJobUrl(job.url);
  const normalizedCompanyTitle = normalizeCompanyTitle(job.company, job.title);

  const row = db
    .prepare(
      `SELECT * FROM applications
       WHERE (job_id IS NOT NULL AND job_id = @jobId)
          OR canonical_url = @canonicalUrl
          OR normalized_company_title = @normalizedCompanyTitle
       LIMIT 1`
    )
    .get({
      jobId: job.jobId,
      canonicalUrl,
      normalizedCompanyTitle,
    }) as ApplicationRecord | undefined;

  return row;
}

export function recordApplication(input: NewApplication): ApplicationRecord {
  const db = getDatabase();
  const canonicalUrl = canonicalizeJobUrl(input.job.url);
  const normalizedCompanyTitle = normalizeCompanyTitle(input.job.company, input.job.title);
  const now = new Date().toISOString();
  const appliedStatuses: ApplicationStatus[] = ["applied", "dry_run"];

  const result = db
    .prepare(
      `INSERT INTO applications
        (job_id, job_url, canonical_url, job_title, company, normalized_company_title,
         location, posted_date, match_score, application_status, application_date,
         resume, search_keyword, error, created_at, updated_at)
       VALUES
        (@jobId, @jobUrl, @canonicalUrl, @jobTitle, @company, @normalizedCompanyTitle,
         @location, @postedDate, @matchScore, @status, @applicationDate,
         @resume, @searchKeyword, @error, @now, @now)`
    )
    .run({
      jobId: input.job.jobId,
      jobUrl: input.job.url,
      canonicalUrl,
      jobTitle: input.job.title,
      company: input.job.company,
      normalizedCompanyTitle,
      location: input.job.location || null,
      postedDate: input.job.postedLabel || null,
      matchScore: input.matchScore,
      status: input.status,
      applicationDate: appliedStatuses.includes(input.status) ? now : null,
      resume: input.resume ?? null,
      searchKeyword: input.job.searchKeyword,
      error: input.error ?? null,
      now,
    });

  return db
    .prepare("SELECT * FROM applications WHERE id = ?")
    .get(result.lastInsertRowid) as ApplicationRecord;
}

export function countApplicationsToday(): number {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM applications
       WHERE application_status = 'applied' AND date(application_date) = date('now')`
    )
    .get() as { count: number };
  return row.count;
}

export function listApplications(limit = 50): ApplicationRecord[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM applications ORDER BY created_at DESC LIMIT ?")
    .all(limit) as ApplicationRecord[];
}

export function getStats(): Record<ApplicationStatus | "total", number> {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT application_status as status, COUNT(*) as count FROM applications GROUP BY application_status`
    )
    .all() as Array<{ status: ApplicationStatus; count: number }>;

  const stats = rows.reduce(
    (acc, row) => ({ ...acc, [row.status]: row.count }),
    {} as Record<ApplicationStatus, number>
  );
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return { ...stats, total } as Record<ApplicationStatus | "total", number>;
}
