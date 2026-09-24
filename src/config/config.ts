import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";

const envSchema = z.object({
  DRY_RUN: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false"),
  BROWSER_PROFILE_DIR: z.string().default("./naukri-browser-profile"),
  BROWSER_HEADLESS: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  MAX_JOB_AGE_DAYS: z.coerce.number().int().positive().default(3),
  SEARCH_KEYWORDS: z.string().optional(),
  MIN_MATCH_SCORE: z.coerce.number().min(0).max(100).default(50),
  MAX_APPLICATIONS_PER_RUN: z.coerce.number().int().positive().default(30),
  MAX_APPLICATIONS_PER_DAY: z.coerce.number().int().positive().default(50),
  DELAY_BETWEEN_APPLICATIONS_MIN_SEC: z.coerce.number().int().nonnegative().default(10),
  DELAY_BETWEEN_APPLICATIONS_MAX_SEC: z.coerce.number().int().nonnegative().default(30),
  DATABASE_PATH: z.string().default("./data/naukri-agent.db"),
  PROFILE_CONFIG_PATH: z.string().default("./config/profile.json"),
  KEYWORDS_CONFIG_PATH: z.string().default("./config/keywords.json"),
  QUESTION_PATTERNS_PATH: z.string().default("./config/question-patterns.json"),
  RESUME_PATH: z.string().default("./resumes/Amit_Saroj_Senior_Full_Stack_Engineer(MERN).pdf"),
  LOG_DIR: z.string().default("./logs"),
  LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig extends Env {
  searchKeywords: string[];
  delayBetweenApplicationsMsRange: [number, number];
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

function loadKeywords(env: Env): string[] {
  if (env.SEARCH_KEYWORDS && env.SEARCH_KEYWORDS.trim().length > 0) {
    return env.SEARCH_KEYWORDS.split(",").map((k) => k.trim()).filter(Boolean);
  }
  const raw = readFileSync(path.resolve(env.KEYWORDS_CONFIG_PATH), "utf-8");
  const parsed = JSON.parse(raw) as { keywords: string[] };
  return parsed.keywords;
}

let cached: AppConfig | undefined;

export function loadConfig(overrides: Partial<Env> = {}): AppConfig {
  if (cached && Object.keys(overrides).length === 0) return cached;
  const env = { ...loadEnv(), ...overrides };
  if (
    env.DELAY_BETWEEN_APPLICATIONS_MIN_SEC > env.DELAY_BETWEEN_APPLICATIONS_MAX_SEC
  ) {
    throw new Error(
      "DELAY_BETWEEN_APPLICATIONS_MIN_SEC must be <= DELAY_BETWEEN_APPLICATIONS_MAX_SEC"
    );
  }
  const config: AppConfig = {
    ...env,
    searchKeywords: loadKeywords(env),
    delayBetweenApplicationsMsRange: [
      env.DELAY_BETWEEN_APPLICATIONS_MIN_SEC * 1000,
      env.DELAY_BETWEEN_APPLICATIONS_MAX_SEC * 1000,
    ],
  };
  if (Object.keys(overrides).length === 0) cached = config;
  return config;
}

/** Test-only: clears the module-level config cache so env changes take effect between test cases. */
export function resetConfigForTests(): void {
  cached = undefined;
}
