import { AppConfig } from "../config/config";
import { countApplicationsToday } from "./repository";
import { getLogger, logEvent } from "../logging/logger";

export class DailyLimitReachedError extends Error {
  constructor(limit: number) {
    super(`Daily application limit reached (${limit}). Stopping run.`);
    this.name = "DailyLimitReachedError";
  }
}

export class NaukriQuotaReachedError extends Error {
  constructor() {
    super("Naukri reported its own application quota reached. Stopping — never bypass this (Phase 11).");
    this.name = "NaukriQuotaReachedError";
  }
}

/**
 * Enforces the run/day caps from Phase 11. Never hammers the site: caller is
 * expected to also apply the randomized inter-application delay it returns.
 */
export class ApplicationTracker {
  private appliedThisRun = 0;

  constructor(private readonly config: AppConfig) {}

  assertCanApplyMore(): void {
    const today = countApplicationsToday();
    if (today >= this.config.MAX_APPLICATIONS_PER_DAY) {
      logEvent("DAILY_LIMIT_REACHED", { limit: this.config.MAX_APPLICATIONS_PER_DAY, today });
      throw new DailyLimitReachedError(this.config.MAX_APPLICATIONS_PER_DAY);
    }
    if (this.appliedThisRun >= this.config.MAX_APPLICATIONS_PER_RUN) {
      logEvent("RUN_LIMIT_REACHED", { limit: this.config.MAX_APPLICATIONS_PER_RUN });
      throw new DailyLimitReachedError(this.config.MAX_APPLICATIONS_PER_RUN);
    }
  }

  recordSuccess(): void {
    this.appliedThisRun += 1;
  }

  get runCount(): number {
    return this.appliedThisRun;
  }

  async waitBetweenApplications(): Promise<void> {
    const [min, max] = this.config.delayBetweenApplicationsMsRange;
    const delayMs = Math.round(min + Math.random() * (max - min));
    getLogger().info({ event: "THROTTLE_DELAY", delayMs });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /** Detects Naukri's own "application limit reached" style messaging and stops immediately (Phase 11). */
  static detectNaukriQuotaMessage(bodyText: string): boolean {
    return /application limit|quota (reached|exceeded)|maximum applications/i.test(bodyText);
  }
}
