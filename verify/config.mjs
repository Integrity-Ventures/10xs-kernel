// Every path this package touches outside a target repo's source files comes from ONE resolved
// config object, built here and passed down. No leaf module re-reads 10xs-kernel.json — that
// would let two call sites drift on what a fresh clone's default should be.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const PACKAGE_ROOT = resolve(HERE, "..");

// A repo with no 10xs-kernel.json at all must still work (the stranger's first five minutes).
// These are the defaults; profiles/10xs.json documents the values today's 10xs monorepo would
// use instead, so the mapping from old behaviour to new config is readable, not asserted.
export const DEFAULT_CONFIG = {
  baseRef: null, // resolved lazily: origin/HEAD, then origin/main, then origin/master
  eventsDir: ".10xs/events",
  eventSchema: join(PACKAGE_ROOT, "spec/schemas/event.v1.schema.json"),
  reportPrefixes: ["reports/"],
  evidencePrefix: ".10xs/evidence",
  instructionsPrefix: "instructions/",
  probeRegistryDir: ".10xs/probes/registry",
  frozenProbeRegistry: ".10xs/probes/registry.json",
  appendFiles: [],
  project: "10xs-kernel",
  gates: { test: { cmd: "npm test", cwd: ".", parse: "exit-code" } },
};

function git(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

// Config precedence: explicit --config flag > 10xs-kernel.json at repoRoot > DEFAULT_CONFIG.
export function loadConfig(repoRoot = process.cwd(), configPath) {
  const path = configPath ? resolve(configPath) : join(repoRoot, "10xs-kernel.json");
  const overrides = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    gates: { ...DEFAULT_CONFIG.gates, ...(overrides.gates ?? {}) },
    _configPath: existsSync(path) ? path : null,
  };
}

// origin/HEAD -> origin/main -> origin/master, in that order, the first that resolves.
export function resolveBaseRef(repoRoot, configuredBaseRef) {
  if (configuredBaseRef) return configuredBaseRef;
  for (const ref of ["origin/HEAD", "origin/main", "origin/master"]) {
    if (git(repoRoot, ["rev-parse", "--verify", "--quiet", ref]).status === 0) return ref;
  }
  throw new Error(
    "no baseRef configured and none of origin/HEAD, origin/main, origin/master resolve; " +
      'set "baseRef" in 10xs-kernel.json',
  );
}
