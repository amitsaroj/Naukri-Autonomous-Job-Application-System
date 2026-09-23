import pino from "pino";
import { mkdirSync } from "fs";
import path from "path";
import { loadConfig } from "../config/config";

let instance: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (instance) return instance;
  const config = loadConfig();
  mkdirSync(path.resolve(config.LOG_DIR), { recursive: true });
  mkdirSync(path.resolve(config.LOG_DIR, "screenshots"), { recursive: true });

  instance = pino(
    { level: config.LOG_LEVEL },
    pino.transport({
      targets: [
        {
          target: "pino-pretty",
          level: config.LOG_LEVEL,
          options: { colorize: true, translateTime: "SYS:standard" },
        },
        {
          target: "pino/file",
          level: config.LOG_LEVEL,
          options: { destination: path.resolve(config.LOG_DIR, "agent.log"), mkdir: true },
        },
      ],
    })
  );
  return instance;
}

/** Structured event log, one JSON object per line, matching the schema in readme Phase 15. */
export function logEvent(
  event: string,
  data: Record<string, unknown> = {}
): void {
  getLogger().info({ event, ...data, timestamp: new Date().toISOString() });
}
