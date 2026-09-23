import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, resetConfigForTests } from "../src/config/config";

const ENV_KEYS = [
  "DRY_RUN",
  "SEARCH_KEYWORDS",
  "DELAY_BETWEEN_APPLICATIONS_MIN_SEC",
  "DELAY_BETWEEN_APPLICATIONS_MAX_SEC",
  "MAX_APPLICATIONS_PER_DAY",
];

beforeEach(() => {
  resetConfigForTests();
});

afterEach(() => {
  resetConfigForTests();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("loadConfig", () => {
  it("defaults DRY_RUN to true for safety", () => {
    const config = loadConfig({});
    expect(config.DRY_RUN).toBe(true);
  });

  it("parses DRY_RUN=false explicitly", () => {
    process.env.DRY_RUN = "false";
    const config = loadConfig({});
    expect(config.DRY_RUN).toBe(false);
  });

  it("prefers SEARCH_KEYWORDS env override over the keywords config file", () => {
    process.env.SEARCH_KEYWORDS = "Backend Developer, Platform Engineer";
    const config = loadConfig({});
    expect(config.searchKeywords).toEqual(["Backend Developer", "Platform Engineer"]);
  });

  it("falls back to the keywords config file when SEARCH_KEYWORDS is unset", () => {
    const config = loadConfig({});
    expect(config.searchKeywords.length).toBeGreaterThan(0);
    expect(config.searchKeywords).toContain("React Developer");
  });

  it("rejects an inverted delay range", () => {
    process.env.DELAY_BETWEEN_APPLICATIONS_MIN_SEC = "60";
    process.env.DELAY_BETWEEN_APPLICATIONS_MAX_SEC = "10";
    expect(() => loadConfig({})).toThrow(/MIN_SEC must be <= .*MAX_SEC/);
  });

  it("computes the delay range in milliseconds", () => {
    process.env.DELAY_BETWEEN_APPLICATIONS_MIN_SEC = "10";
    process.env.DELAY_BETWEEN_APPLICATIONS_MAX_SEC = "30";
    const config = loadConfig({});
    expect(config.delayBetweenApplicationsMsRange).toEqual([10000, 30000]);
  });
});
