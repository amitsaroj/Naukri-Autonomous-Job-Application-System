import { Page } from "playwright";
import { getLogger, logEvent } from "../logging/logger";

const NAUKRI_HOME = "https://www.naukri.com/mnjuser/homepage";
const LOGIN_URL_FRAGMENT = "nlogin/login";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Naukri authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class SecurityChallengeError extends Error {
  constructor(public readonly kind: "CAPTCHA_DETECTED" | "OTP_REQUIRED" | "SECURITY_CHECK_REQUIRED") {
    super(`Naukri security challenge detected: ${kind}`);
    this.name = "SecurityChallengeError";
  }
}

/**
 * Verifies the persistent browser profile already holds a logged-in Naukri
 * session. Never attempts to submit credentials itself (Phase 14).
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  await page.goto(NAUKRI_HOME, { waitUntil: "domcontentloaded" });
  await detectSecurityChallenge(page);

  const url = page.url();
  if (url.includes(LOGIN_URL_FRAGMENT)) {
    logEvent("AUTHENTICATION_REQUIRED");
    throw new AuthenticationRequiredError();
  }

  // Verified 2026-09-23 against a real authenticated Naukri session (Phase 19).
  // The homepage nav is client-rendered, so wait for it rather than checking
  // immediately after domcontentloaded (which fires before React hydrates).
  const loggedInMarker = page.locator(
    "[class*='nI-gNb-header'], a[href*='mnjuser/profile'], [class*='nI-gNb-menus']"
  );
  const visible = await loggedInMarker
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    logEvent("AUTHENTICATION_REQUIRED", { reason: "logged_in_marker_not_found" });
    throw new AuthenticationRequiredError();
  }

  getLogger().info({ event: "SESSION_VALID" });
}

/**
 * Detects CAPTCHA/OTP/anti-bot states and pauses (Phase 12). Never attempts
 * to solve or bypass them.
 */
export async function detectSecurityChallenge(page: Page): Promise<void> {
  const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();

  if (/captcha/.test(bodyText)) {
    logEvent("CAPTCHA_DETECTED", { url: page.url() });
    throw new SecurityChallengeError("CAPTCHA_DETECTED");
  }
  if (/enter otp|one time password|verification code/.test(bodyText)) {
    logEvent("OTP_REQUIRED", { url: page.url() });
    throw new SecurityChallengeError("OTP_REQUIRED");
  }
  if (/unusual activity|security check|verify you are human|access denied/.test(bodyText)) {
    logEvent("SECURITY_CHECK_REQUIRED", { url: page.url() });
    throw new SecurityChallengeError("SECURITY_CHECK_REQUIRED");
  }
}

/** Used by `npm run login`: opens the login page and waits for a human to complete it manually. */
export async function waitForManualLogin(page: Page, timeoutMs = 5 * 60_000): Promise<void> {
  await page.goto("https://www.naukri.com/nlogin/login", { waitUntil: "domcontentloaded" });
  getLogger().info(
    "Please log in to Naukri manually in the opened browser window (including any OTP/CAPTCHA). Waiting up to 5 minutes..."
  );
  await page.waitForURL((url) => !url.pathname.includes(LOGIN_URL_FRAGMENT), {
    timeout: timeoutMs,
  });
  getLogger().info({ event: "MANUAL_LOGIN_COMPLETE" });
}
