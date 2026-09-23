import { existsSync } from "fs";
import path from "path";
import { loadConfig } from "../config/config";
import { loadProfile } from "./profile";

export function resolveResumePath(): string {
  const config = loadConfig();
  const profile = loadProfile();
  const candidate = path.resolve(config.RESUME_PATH || profile.resumePath);
  if (!existsSync(candidate)) {
    throw new Error(
      `Resume file not found at ${candidate}. Set RESUME_PATH or config/profile.json:resumePath to a valid file.`
    );
  }
  return candidate;
}
