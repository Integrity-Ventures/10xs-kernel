#!/usr/bin/env node
// The one command a stranger can type. `check` is harvest + gate in one call — the whole
// stranger-fixture DoD lives behind this file. `harvest` and `gate` are the primitives it wraps,
// exposed unchanged so an agent that only needs one half can call it directly.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "..");
const HARVEST = join(PACKAGE_ROOT, "verify/harvest.mjs");
const REPORT_GATE = join(PACKAGE_ROOT, "verify/report-gate.mjs");

const HELP = `Usage: 10xs <command> [options]

Commands:
  check --report <path> --base <ref> [--test-cmd "<cmd>"]
      Harvest fresh facts, then gate the report against them. Exit 0 = the
      report survived re-measurement. Exit 1 = it did not (findings on
      stdout). Exit 2 = usage error.
  harvest --repo <path> --mt-id <id> --base <ref> [--test-cmd "<cmd>"] --out <dir>
      The primitive behind "check": measures changed files and (optionally)
      runs a test command. Same flags as "check" minus --report.
  gate --report <path> --facts <path> [--repo <path>] [--allow-stale]
      The primitive behind "check": checks a report's claims against a
      report-facts.json. Findings RG001-RG008 printed, never just the first.

10xs --help   Show this message.
`;

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

// Findings are the point of this tool, so they always land on stdout regardless of which stream
// the wrapped primitive wrote them to.
function relay(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stdout.write(result.stderr);
  return result.status ?? 2;
}

function flagValue(args, flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function check(args) {
  const report = flagValue(args, "--report");
  const base = flagValue(args, "--base");
  const testCmd = flagValue(args, "--test-cmd");
  const repo = resolve(flagValue(args, "--repo") ?? process.cwd());
  if (!report || !base) {
    console.error('Usage: 10xs check --report <path> --base <ref> [--test-cmd "<cmd>"]');
    process.exit(2);
  }
  const out = mkdtempSync(join(tmpdir(), "10xs-check-"));
  const harvestArgs = ["--repo", repo, "--mt-id", "check", "--base", base, "--out", out];
  if (testCmd) harvestArgs.push("--test-cmd", testCmd);
  const harvested = run(HARVEST, harvestArgs);
  if (harvested.status !== 0) process.exit(relay(harvested));
  const factsPath = join(out, "report-facts.json");
  const gated = run(REPORT_GATE, ["--report", resolve(report), "--facts", factsPath, "--repo", repo]);
  process.exit(relay(gated));
}

function harvest(args) {
  process.exit(relay(run(HARVEST, args)));
}

function gate(args) {
  process.exit(relay(run(REPORT_GATE, args)));
}

const [command, ...rest] = process.argv.slice(2);
if (command === "--help" || command === "-h") {
  console.log(HELP);
  process.exit(0);
} else if (command === "check") {
  check(rest);
} else if (command === "harvest") {
  harvest(rest);
} else if (command === "gate") {
  gate(rest);
} else {
  console.error(command ? `unknown command: ${command}\n\n${HELP}` : HELP);
  process.exit(2);
}
