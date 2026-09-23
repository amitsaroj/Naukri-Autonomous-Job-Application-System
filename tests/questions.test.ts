import { beforeEach, describe, expect, it } from "vitest";
import { resetConfigForTests } from "../src/config/config";
import { matchQuestion } from "../src/questions/matcher";
import { answerQuestion } from "../src/questions/answerer";
import type { CandidateProfile } from "../src/profile/profile";

const profile: CandidateProfile = {
  name: "Amit Saroj",
  currentTitle: "Software Engineer (Full Stack)",
  targetRoles: [],
  totalExperienceYears: 5.7,
  totalExperienceStatement: "5+ years",
  skills: { core: [], frontend: [], testing: [], observability: [], web3: [], ai: [] },
  experienceByTech: { reactYears: 5 },
  employmentHistory: [],
  currentCompany: "Antier Solutions",
  currentDesignation: "Software Engineer",
  currentLocation: "Mohali, India",
  preferredLocations: [],
  preferredWorkMode: [],
  noticePeriodDays: 30,
  currentCtcLpa: 12,
  expectedCtcMinLpa: 18,
  expectedCtcMaxLpa: 20,
  employmentTypePreference: [],
  education: { degree: "Diploma in Computer Science and Engineering" },
  contact: { email: "sarojamit4956@gmail.com", phone: "+918707831236" },
  resumePath: "./resumes/resume.pdf",
  willingToRelocate: null,
  workAuthorization: null,
  visaStatus: null,
  certifications: [],
};

beforeEach(() => {
  resetConfigForTests();
});

describe("matchQuestion", () => {
  it("matches a known question phrasing", () => {
    expect(matchQuestion("What is your notice period?")?.id).toBe("notice_period");
  });

  it("returns null for an unrecognized question", () => {
    expect(matchQuestion("Do you own a car?")).toBeNull();
  });
});

describe("answerQuestion", () => {
  it("answers from a verified profile fact", () => {
    const result = answerQuestion("What is your current CTC?", profile, true);
    expect(result.answered).toBe(true);
    expect(result.answer).toBe("12 LPA");
  });

  it("blocks a mandatory question with no matching pattern instead of guessing", () => {
    const result = answerQuestion("Are you willing to relocate to Dubai?", profile, true);
    expect(result.answered).toBe(false);
    expect(result.blockReason).toBeTruthy();
  });

  it("blocks a mandatory question whose fact is unknown rather than fabricating it", () => {
    const result = answerQuestion(
      "What is your total experience?",
      { ...profile, totalExperienceStatement: "" },
      true
    );
    expect(result.answered).toBe(false);
    expect(result.blockReason).toMatch(/unknown/);
  });

  it("does not block a non-mandatory unanswered question", () => {
    const result = answerQuestion("Do you own a car?", profile, false);
    expect(result.answered).toBe(false);
    expect(result.blockReason).toBeNull();
  });
});
