import { JobDetail } from "../naukri/parser";
import { CandidateProfile } from "../profile/profile";
import { DEFAULT_WEIGHTS, TITLE_VETO_PATTERNS, ScoringWeights } from "./rules";

export interface MatchResult {
  score: number;
  vetoed: boolean;
  vetoReason: string | null;
  breakdown: Record<keyof ScoringWeights, number>;
  reasons: string[];
}

function scoreTitle(job: JobDetail, profile: CandidateProfile): number {
  const title = job.title.toLowerCase();
  const hit = profile.targetRoles.some((role) => title.includes(role.toLowerCase()));
  if (hit) return 1;
  const looseHit = /react|node|full.?stack|mern|software engineer|javascript|typescript/.test(title);
  return looseHit ? 0.6 : 0;
}

function scoreTechnologies(job: JobDetail, profile: CandidateProfile): number {
  const haystack = `${job.description} ${job.skills.join(" ")}`.toLowerCase();
  const allSkills = [...profile.skills.core, ...profile.skills.frontend];
  if (allSkills.length === 0) return 0;
  const hits = allSkills.filter((skill) => haystack.includes(skill.toLowerCase()));
  return Math.min(1, hits.length / Math.min(6, allSkills.length));
}

function scoreExperience(job: JobDetail, profile: CandidateProfile): number {
  if (job.minExperienceYears === null) return 0.7; // unspecified: neutral-positive, don't veto
  const candidateYears = profile.totalExperienceYears;
  const min = job.minExperienceYears;
  const max = job.maxExperienceYears ?? min + 3;
  if (candidateYears >= min && candidateYears <= max) return 1;
  if (candidateYears < min) return Math.max(0, 1 - (min - candidateYears) / 3);
  return Math.max(0, 1 - (candidateYears - max) / 4);
}

function scoreLocation(job: JobDetail, profile: CandidateProfile): number {
  const jobLocation = job.location.toLowerCase();
  if (!jobLocation) return 0.5;
  const hit = profile.preferredLocations.some((loc) => jobLocation.includes(loc.toLowerCase()));
  return hit ? 1 : job.workMode === "remote" ? 0.9 : 0.2;
}

function scoreWorkMode(job: JobDetail, profile: CandidateProfile): number {
  const hit = profile.preferredWorkMode.some(
    (mode) => mode.toLowerCase() === job.workMode || (mode.toLowerCase() === "onsite" && job.workMode === "unknown")
  );
  return hit ? 1 : 0.4;
}

function scoreEmploymentType(job: JobDetail, profile: CandidateProfile): number {
  if (!job.employmentType) return 0.7;
  const hit = profile.employmentTypePreference.some(
    (t) => t.toLowerCase() === job.employmentType?.toLowerCase()
  );
  return hit ? 1 : 0;
}

/**
 * Deterministic job-matching engine (Phase 8). Same inputs always produce the
 * same score — no randomness, no LLM calls.
 */
export function scoreJob(
  job: JobDetail,
  profile: CandidateProfile,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): MatchResult {
  const vetoPattern = TITLE_VETO_PATTERNS.find((pattern) => pattern.test(job.title));
  if (vetoPattern) {
    return {
      score: 0,
      vetoed: true,
      vetoReason: `Title matched veto pattern: ${vetoPattern}`,
      breakdown: { title: 0, technologies: 0, experience: 0, location: 0, workMode: 0, employmentType: 0 },
      reasons: [`Rejected: title "${job.title}" matches a disqualifying pattern.`],
    };
  }

  const dims: Record<keyof ScoringWeights, number> = {
    title: scoreTitle(job, profile),
    technologies: scoreTechnologies(job, profile),
    experience: scoreExperience(job, profile),
    location: scoreLocation(job, profile),
    workMode: scoreWorkMode(job, profile),
    employmentType: scoreEmploymentType(job, profile),
  };

  const breakdown = Object.fromEntries(
    (Object.keys(dims) as Array<keyof ScoringWeights>).map((key) => [
      key,
      Math.round(dims[key] * weights[key]),
    ])
  ) as Record<keyof ScoringWeights, number>;

  const score = Math.round(
    (Object.keys(dims) as Array<keyof ScoringWeights>).reduce(
      (sum, key) => sum + dims[key] * weights[key],
      0
    )
  );

  const reasons = [
    `title=${breakdown.title}/${weights.title}`,
    `technologies=${breakdown.technologies}/${weights.technologies}`,
    `experience=${breakdown.experience}/${weights.experience}`,
    `location=${breakdown.location}/${weights.location}`,
    `workMode=${breakdown.workMode}/${weights.workMode}`,
    `employmentType=${breakdown.employmentType}/${weights.employmentType}`,
  ];

  return { score, vetoed: false, vetoReason: null, breakdown, reasons };
}
