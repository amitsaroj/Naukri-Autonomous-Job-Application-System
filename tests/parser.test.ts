import { describe, expect, it } from "vitest";
import {
  canonicalizeJobUrl,
  extractJobId,
  normalizeCompanyTitle,
  parsePostedDaysAgo,
} from "../src/naukri/parser";

describe("extractJobId", () => {
  it("extracts a trailing numeric id", () => {
    expect(extractJobId("https://www.naukri.com/job-listings-react-developer-123456789")).toBe(
      "123456789"
    );
  });

  it("returns null when no numeric id is present", () => {
    expect(extractJobId("https://www.naukri.com/react-developer-jobs")).toBeNull();
  });
});

describe("canonicalizeJobUrl", () => {
  it("strips query params and hash", () => {
    expect(canonicalizeJobUrl("https://www.naukri.com/job/123?src=abc&utm=x#frag")).toBe(
      "https://www.naukri.com/job/123"
    );
  });
});

describe("normalizeCompanyTitle", () => {
  it("normalizes case/punctuation for dedup matching", () => {
    expect(normalizeCompanyTitle("Acme, Inc.", "Senior React Developer")).toBe(
      normalizeCompanyTitle("acme inc", "senior   react developer")
    );
  });
});

describe("parsePostedDaysAgo", () => {
  it.each([
    ["Today", 0],
    ["few hours ago", 0],
    ["2 days ago", 2],
    ["1 week ago", 7],
    ["", null],
    ["1 month ago", 30],
  ])("parses %s -> %s", (label, expected) => {
    expect(parsePostedDaysAgo(label)).toBe(expected);
  });
});
