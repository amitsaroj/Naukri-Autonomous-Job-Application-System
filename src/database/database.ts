import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "fs";
import path from "path";
import { loadConfig } from "../config/config";

let db: Database.Database | undefined;

export function getDatabase(): Database.Database {
  if (db) return db;
  const config = loadConfig();
  const dbPath = path.resolve(config.DATABASE_PATH);
  mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const migrationPath = path.resolve(__dirname, "migrations/001_init.sql");
  const migrationSql = readFileSync(migrationPath, "utf-8");
  db.exec(migrationSql);

  return db;
}

export function closeDatabase(): void {
  db?.close();
  db = undefined;
}

/** Test-only alias: closes and clears the cached connection so a new DATABASE_PATH takes effect. */
export function resetDatabaseForTests(): void {
  closeDatabase();
}
