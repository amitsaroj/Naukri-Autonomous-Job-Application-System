import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { loadConfig, resetConfigForTests } from "../src/config/config";
import { resetDatabaseForTests } from "../src/database/database";
import { recordApplication } from "../src/applications/repository";
import { ApplicationTracker, DailyLimitReachedError } from "../src/applications/tracker";
import type { JobListing } from "../src/naukri/parser";

let tmpDir: string;

function job(id: string): JobListing {
  return {
    jobId: id,
    title: "Full Stack Developer",
    company: `Company ${id}`,
    location: "Remote",
    url: `https://www.naukri.com/job/${id}`,
    postedLabel: "Today",
    postedDaysAgo: 0,
    searchKeyword: "Full Stack Developer",
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "naukri-agent-tracker-test-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
  process.env.MAX_APPLICATIONS_PER_DAY = "2";
  process.env.MAX_APPLICATIONS_PER_RUN = "10";
  resetConfigForTests();
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MAX_APPLICATIONS_PER_DAY;
  delete process.env.MAX_APPLICATIONS_PER_RUN;
});

describe("ApplicationTracker", () => {
  it("stops once the daily limit is reached, even across separate tracker instances", () => {
    const config = loadConfig({ MAX_APPLICATIONS_PER_DAY: 2 });
    recordApplication({ job: job("1"), matchScore: 90, status: "applied" });
    recordApplication({ job: job("2"), matchScore: 90, status: "applied" });

    const tracker = new ApplicationTracker(config);
    expect(() => tracker.assertCanApplyMore()).toThrow(DailyLimitReachedError);
  });

  it("allows applying while under the daily limit", () => {
    const config = loadConfig({ MAX_APPLICATIONS_PER_DAY: 2 });
    recordApplication({ job: job("1"), matchScore: 90, status: "applied" });

    const tracker = new ApplicationTracker(config);
    expect(() => tracker.assertCanApplyMore()).not.toThrow();
  });

  it("enforces the per-run cap independently of the daily cap", () => {
    const config = loadConfig({ MAX_APPLICATIONS_PER_DAY: 100, MAX_APPLICATIONS_PER_RUN: 1 });
    const tracker = new ApplicationTracker(config);
    tracker.recordSuccess();
    expect(() => tracker.assertCanApplyMore()).toThrow(DailyLimitReachedError);
  });

  it("detects Naukri's own quota messaging", () => {
    expect(ApplicationTracker.detectNaukriQuotaMessage("You have reached your application limit for today")).toBe(
      true
    );
    expect(ApplicationTracker.detectNaukriQuotaMessage("Great job, keep applying!")).toBe(false);
  });
});
