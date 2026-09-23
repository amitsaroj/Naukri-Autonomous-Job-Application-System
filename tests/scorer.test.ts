import { describe, expect, it } from "vitest";
import { scoreJob } from "../src/matching/scorer";
import type { CandidateProfile } from "../src/profile/profile";
import type { JobDetail } from "../src/naukri/parser";

const profile: CandidateProfile = {
  name: "Amit Saroj",
  currentTitle: "Software Engineer (Full Stack)",
  targetRoles: ["Full Stack Developer", "Software Engineer", "Senior React Developer"],
  totalExperienceYears: 5.7,
  totalExperienceStatement: "5+ years",
  skills: {
    core: ["React.js", "Node.js", "TypeScript", "MongoDB", "AWS", "Docker"],
    frontend: ["React.js", "Next.js"],
    testing: [],
    observability: [],
    web3: [],
    ai: [],
  },
  experienceByTech: { reactYears: 5, nodeYears: 5.7 },
  employmentHistory: [],
  currentCompany: "Antier Solutions",
  currentDesignation: "Software Engineer",
  currentLocation: "Mohali, India",
  preferredLocations: ["Remote", "Chandigarh", "Mohali", "Delhi NCR", "India"],
  preferredWorkMode: ["Remote", "Hybrid", "Onsite"],
  noticePeriodDays: 30,
  currentCtcLpa: 12,
  expectedCtcMinLpa: 18,
  expectedCtcMaxLpa: 20,
  employmentTypePreference: ["Full-time"],
  education: { degree: "Diploma in Computer Science and Engineering" },
  contact: { email: "sarojamit4956@gmail.com", phone: "+918707831236" },
  resumePath: "./resumes/resume.pdf",
  willingToRelocate: null,
  workAuthorization: null,
  visaStatus: null,
  certifications: [],
};

function job(overrides: Partial<JobDetail>): JobDetail {
  return {
    jobId: "1",
    title: "Senior React Developer",
    company: "TestCo",
    location: "Mohali, India",
    url: "https://www.naukri.com/job/1",
    postedLabel: "Today",
    postedDaysAgo: 0,
    searchKeyword: "React Developer",
    description: "React.js Node.js TypeScript MongoDB AWS Docker",
    experienceLabel: "3-6 Yrs",
    minExperienceYears: 3,
    maxExperienceYears: 6,
    salaryLabel: null,
    skills: ["React.js", "Node.js"],
    workMode: "onsite",
    employmentType: "Full-time",
    ...overrides,
  };
}

describe("scoreJob", () => {
  it("scores a strong match well above the default threshold", () => {
    const result = scoreJob(job({}), profile);
    expect(result.vetoed).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("vetoes titles matching disqualifying patterns", () => {
    const result = scoreJob(job({ title: "Manual Tester" }), profile);
    expect(result.vetoed).toBe(true);
    expect(result.score).toBe(0);
  });

  it("scores a poor tech/experience match lower than a strong match", () => {
    // Location isn't a useful discriminator here: the profile's "India"
    // preference is a deliberate catch-all (real Naukri postings are
    // virtually always India-based), so it scores well regardless of city.
    const strong = scoreJob(job({}), profile);
    const weak = scoreJob(
      job({
        description: "Java Spring Boot Oracle",
        skills: ["Java", "Spring"],
        minExperienceYears: 12,
        maxExperienceYears: 18,
      }),
      profile
    );
    expect(weak.score).toBeLessThan(strong.score);
  });

  it("still scores a non-Indian posting lower on location than an Indian one", () => {
    const indian = scoreJob(job({ location: "Bengaluru" }), profile);
    const overseas = scoreJob(job({ location: "Munich, Germany", workMode: "onsite" }), profile);
    expect(overseas.breakdown.location).toBeLessThan(indian.breakdown.location);
  });

  it("does not reject jobs with an unspecified experience range", () => {
    const result = scoreJob(job({ minExperienceYears: null, maxExperienceYears: null }), profile);
    expect(result.breakdown.experience).toBeGreaterThan(0);
  });
});
