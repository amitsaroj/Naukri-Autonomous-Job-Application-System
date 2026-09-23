CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  job_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  normalized_company_title TEXT NOT NULL,
  location TEXT,
  posted_date TEXT,
  match_score INTEGER,
  application_status TEXT NOT NULL DEFAULT 'pending',
  application_date TEXT,
  resume TEXT,
  search_keyword TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Duplicate-prevention signals per Phase 10: job_id, canonical_url, normalized company+title.
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_job_id
  ON applications (job_id) WHERE job_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_canonical_url
  ON applications (canonical_url);
CREATE INDEX IF NOT EXISTS idx_applications_norm_company_title
  ON applications (normalized_company_title);
CREATE INDEX IF NOT EXISTS idx_applications_status_date
  ON applications (application_status, application_date);
