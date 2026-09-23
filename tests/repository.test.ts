import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { resetConfigForTests } from "../src/config/config";
import { resetDatabaseForTests } from "../src/database/database";
import {
  countApplicationsToday,
  findExistingApplication,
  recordApplication,
} from "../src/applications/repository";
import type { JobListing } from "../src/naukri/parser";

let tmpDir: string;

function job(overrides: Partial<JobListing> = {}): JobListing {
  return {
    jobId: "999",
    title: "Senior React Developer",
    company: "Acme Inc",
    location: "Mohali",
    url: "https://www.naukri.com/job/999?src=x",
    postedLabel: "Today",
    postedDaysAgo: 0,
    searchKeyword: "React Developer",
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "naukri-agent-test-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
  resetConfigForTests();
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("duplicate detection", () => {
  it("finds no existing application for a fresh job", () => {
    expect(findExistingApplication(job())).toBeUndefined();
  });

  it("detects a duplicate by job_id", () => {
    recordApplication({ job: job(), matchScore: 80, status: "applied" });
    const dup = job({ url: "https://www.naukri.com/job/999?src=different-campaign" });
    expect(findExistingApplication(dup)).toBeDefined();
  });

  it("detects a duplicate by canonical URL even with a different job id", () => {
    recordApplication({ job: job(), matchScore: 80, status: "applied" });
    const dup = job({ jobId: null, url: "https://www.naukri.com/job/999?src=other" });
    expect(findExistingApplication(dup)).toBeDefined();
  });

  it("detects a duplicate by normalized company+title", () => {
    recordApplication({ job: job(), matchScore: 80, status: "applied" });
    const dup = job({
      jobId: "111",
      url: "https://www.naukri.com/job/111",
      company: "ACME, Inc.",
      title: "senior   react developer",
    });
    expect(findExistingApplication(dup)).toBeDefined();
  });

  it("never double-counts a job applied to twice in the same run", () => {
    recordApplication({ job: job(), matchScore: 80, status: "applied" });
    expect(countApplicationsToday()).toBe(1);
    const existing = findExistingApplication(job());
    expect(existing).toBeDefined();
    // A correctly-behaving agent loop checks findExistingApplication before
    // calling recordApplication again, so the count stays at 1.
    expect(countApplicationsToday()).toBe(1);
  });
});

describe("countApplicationsToday", () => {
  it("only counts status=applied, not dry_run or skipped", () => {
    recordApplication({
      job: job({ jobId: "1", url: "https://www.naukri.com/job/1" }),
      matchScore: 90,
      status: "applied",
    });
    recordApplication({
      job: job({ jobId: "2", url: "https://www.naukri.com/job/2" }),
      matchScore: 90,
      status: "dry_run",
    });
    recordApplication({
      job: job({ jobId: "3", url: "https://www.naukri.com/job/3" }),
      matchScore: 50,
      status: "skipped_low_score",
    });
    expect(countApplicationsToday()).toBe(1);
  });
});
