import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import { loadConfig } from "../config/config";
import { getLogger } from "../logging/logger";

let context: BrowserContext | undefined;

/**
 * Launches (or reuses) a persistent Chromium profile so a manual Naukri login
 * (Phase 14) survives across runs. Never touches Naukri credentials directly.
 */
export async function getBrowserContext(): Promise<BrowserContext> {
  if (context) return context;
  const config = loadConfig();
  const userDataDir = path.resolve(config.BROWSER_PROFILE_DIR);

  context = await chromium.launchPersistentContext(userDataDir, {
    headless: config.BROWSER_HEADLESS,
    viewport: { width: 1366, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

  context.on("close", () => {
    getLogger().info({ event: "BROWSER_CONTEXT_CLOSED" });
  });

  return context;
}

export async function getPage(): Promise<Page> {
  const ctx = await getBrowserContext();
  const existing = ctx.pages();
  return existing[0] ?? (await ctx.newPage());
}

export async function closeBrowserContext(): Promise<void> {
  await context?.close();
  context = undefined;
}

export async function saveScreenshot(page: Page, name: string): Promise<string> {
  const config = loadConfig();
  const safeName = name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 120);
  const filePath = path.resolve(
    config.LOG_DIR,
    "screenshots",
    `${Date.now()}_${safeName}.png`
  );
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => undefined);
  return filePath;
}
