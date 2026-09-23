export interface ScoringWeights {
  title: number;
  technologies: number;
  experience: number;
  location: number;
  workMode: number;
  employmentType: number;
}

/** Weights must sum to 100; each dimension below contributes its share of the 0-100 match score. */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  title: 25,
  technologies: 30,
  experience: 20,
  location: 15,
  workMode: 5,
  employmentType: 5,
};

/** Job titles that immediately veto a job regardless of other signals (Phase 8 "reject unsuitable jobs"). */
export const TITLE_VETO_PATTERNS = [
  /\bqa\b/i,
  /manual tester/i,
  /\bsales\b/i,
  /business development/i,
  /\bhr\b/i,
  /devops engineer\b(?!.*full.?stack)/i,
  /data entry/i,
  /^(?!.*(react|node|full.?stack|mern|javascript|typescript|software engineer)).*(java developer|\.net developer|php developer|android developer|ios developer)/i,
];
