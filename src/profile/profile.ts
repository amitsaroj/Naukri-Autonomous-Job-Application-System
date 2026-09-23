import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";
import { loadConfig } from "../config/config";

const employmentSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().nullable(),
});

export const profileSchema = z.object({
  name: z.string(),
  currentTitle: z.string(),
  targetRoles: z.array(z.string()),
  totalExperienceYears: z.number(),
  totalExperienceStatement: z.string(),
  skills: z.object({
    core: z.array(z.string()),
    frontend: z.array(z.string()).default([]),
    testing: z.array(z.string()).default([]),
    observability: z.array(z.string()).default([]),
    web3: z.array(z.string()).default([]),
    ai: z.array(z.string()).default([]),
  }),
  experienceByTech: z.record(z.string(), z.number()),
  employmentHistory: z.array(employmentSchema),
  currentCompany: z.string(),
  currentDesignation: z.string(),
  currentLocation: z.string(),
  preferredLocations: z.array(z.string()),
  preferredWorkMode: z.array(z.string()),
  noticePeriodDays: z.number(),
  currentCtcLpa: z.number(),
  expectedCtcMinLpa: z.number(),
  expectedCtcMaxLpa: z.number(),
  employmentTypePreference: z.array(z.string()),
  education: z.object({
    degree: z.string(),
    institute: z.string().optional(),
    startYear: z.number().optional(),
    endYear: z.number().optional(),
    tenthPercent: z.number().optional(),
    twelfthPercent: z.number().optional(),
  }),
  contact: z.object({
    email: z.string(),
    phone: z.string(),
    alternatePhone: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    portfolio: z.string().optional(),
  }),
  resumePath: z.string(),
  // Deliberately nullable: never fabricated. A mandatory question that
  // depends on one of these blocks the application (Phase 9).
  willingToRelocate: z.boolean().nullable(),
  workAuthorization: z.string().nullable(),
  visaStatus: z.string().nullable(),
  certifications: z.array(z.string()).default([]),
});

export type CandidateProfile = z.infer<typeof profileSchema>;

let cached: CandidateProfile | undefined;

export function loadProfile(): CandidateProfile {
  if (cached) return cached;
  const config = loadConfig();
  const raw = readFileSync(path.resolve(config.PROFILE_CONFIG_PATH), "utf-8");
  cached = profileSchema.parse(JSON.parse(raw));
  return cached;
}

/** Dot-path fact lookup used by the questionnaire answerer (Phase 9). Returns undefined, never a guess. */
export function getProfileFact(profile: CandidateProfile, factPath: string): unknown {
  return factPath
    .split(".")
    .reduce<unknown>((acc, key) => {
      if (acc === undefined || acc === null || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[key];
    }, profile);
}
