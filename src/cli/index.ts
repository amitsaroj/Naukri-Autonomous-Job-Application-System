#!/usr/bin/env node
import { Command } from "commander";
import {
  agentCommand,
  applicationsCommand,
  debugCommand,
  loginCommand,
  searchCommand,
  statsCommand,
} from "./commands";
import { getLogger } from "../logging/logger";

const program = new Command();
program.name("naukri-agent").description("Autonomous, guarded Naukri.com job application agent");

program
  .command("login")
  .description("Open a real browser window for a one-time manual Naukri login (Phase 14)")
  .action(async () => {
    await loginCommand();
  });

program
  .command("agent")
  .description("Run the full search -> match -> apply workflow")
  .option("--dry-run", "Inspect and report without submitting any application (Phase 13)")
  .action(async (opts: { dryRun?: boolean }) => {
    await agentCommand(opts);
  });

program
  .command("search")
  .description("Search and score jobs without applying")
  .action(async () => {
    await searchCommand();
  });

program
  .command("applications")
  .description("List recent tracked applications")
  .action(() => {
    applicationsCommand();
  });

program
  .command("stats")
  .description("Show application counts by status")
  .action(() => {
    statsCommand();
  });

program
  .command("debug")
  .description("Print resolved config/profile and check Naukri session validity")
  .action(async () => {
    await debugCommand();
  });

program.parseAsync(process.argv).catch((err) => {
  getLogger().error({ event: "CLI_FATAL_ERROR", error: err instanceof Error ? err.stack : String(err) });
  process.exitCode = 1;
});
