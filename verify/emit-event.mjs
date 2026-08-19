#!/usr/bin/env node
// Emits one governance event: build → validate against the on-disk schema →
// write once, never overwrite.
//
// Adapted from the monorepo's scripts/governance/emit-event.mjs: SCHEMA_PATH and DEFAULT_OUT_DIR
// were derived there from the script's own location relative to a known repo layout (a fixed
// events directory under a fixed project-docs root); here both come from verify/config.mjs
// (10xs-kernel.json, or its bundled defaults), resolved once in main().
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { validateEvent } from "./validate-event.mjs";
import { assertNoNullTokens } from "./null-token-guard.mjs";
import { loadConfig } from "./config.mjs";

function readStdin() {
  return new Promise((res) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
  });
}

function nowTs() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function coerce(v) {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function camel(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const args = { claim: {}, observed: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (key === "dry-run") { args.dryRun = true; continue; }
    if (key === "no-verify-sha") { args.noVerifySha = true; continue; }
    const val = argv[++i];
    if (val === undefined) throw new Error(`--${key} expects a value`);
    if (key === "claim" || key === "observed") {
      const eq = val.indexOf("=");
      if (eq === -1) throw new Error(`--${key} expects k=v, got "${val}"`);
      args[key][val.slice(0, eq)] = coerce(val.slice(eq + 1));
      continue;
    }
    args[camel(key)] = val;
  }
  return args;
}

function gitResult(args) {
  return spawnSync("git", args, { encoding: "utf8" });
}

function verifyShas(event, skipRequested) {
  const inRepo = gitResult(["rev-parse", "--is-inside-work-tree"]);
  const skipped = skipRequested || inRepo.status !== 0 || inRepo.stdout.trim() !== "true";
  if (skipped) {
    if (!event.claim || typeof event.claim !== "object") event.claim = {};
    if (!("sha_unverified" in event.claim)) event.claim.sha_unverified = true;
    return;
  }
  for (const key of ["sha", "base_sha"]) {
    const value = event.subject?.[key];
    if (value === null || value === undefined) continue;
    const check = gitResult(["cat-file", "-t", value]);
    if (check.status !== 0 || check.stdout.trim() !== "commit") {
      throw new Error(`subject.${key} does not resolve to a commit: ${value}`);
    }
  }
}

function withoutUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

function buildFromFlags(args, project) {
  const actor = withoutUndefined({
    kind: args.actorKind,
    model: args.actorModel ?? null,
    machine: args.actorMachine,
    role: args.actorRole,
  });
  const subject = withoutUndefined({
    branch: args.branch ?? null,
    sha: args.sha ?? null,
    base_sha: args.baseSha ?? null,
  });
  return withoutUndefined({
    schema: "10xs.event/1",
    ts: args.ts || nowTs(),
    round: args.round,
    project: args.project || project,
    mt_id: args.mtId ?? null,
    kind: args.kind,
    actor,
    subject,
    claim: args.claim,
    observed: Object.keys(args.observed).length ? args.observed : null,
    evidence: args.evidence ?? null,
    notes: args.notes ?? "",
  });
}

function scopeToken(event) {
  return event.mt_id ?? "scope";
}

function availablePath(dir, base) {
  let suffix = "";
  let n = 1;
  for (;;) {
    const full = join(dir, `${base}${suffix}.json`);
    if (!existsSync(full)) return full;
    n += 1;
    suffix = `-${n}`;
  }
}

function writeEventFile(dir, base, content) {
  mkdirSync(dir, { recursive: true });
  let suffix = "";
  let n = 1;
  for (;;) {
    const full = join(dir, `${base}${suffix}.json`);
    try {
      writeFileSync(full, content, { flag: "wx" });
      return full;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      n += 1;
      suffix = `-${n}`;
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const cfg = loadConfig(resolve(process.cwd()));
  const jsonIdx = argv.indexOf("--json");
  const outDirIdx = argv.indexOf("--out-dir");
  const dryRun = argv.includes("--dry-run");
  const outDir = outDirIdx !== -1 ? resolve(argv[outDirIdx + 1]) : resolve(process.cwd(), cfg.eventsDir);
  const parsed = parseArgs(argv);

  let event;
  if (jsonIdx !== -1) {
    const src = argv[jsonIdx + 1];
    const raw = src === "-" ? await readStdin() : readFileSync(src, "utf8");
    event = JSON.parse(raw);
  } else {
    event = buildFromFlags(parsed, cfg.project);
  }

  assertNoNullTokens(event);
  verifyShas(event, parsed.noVerifySha);

  const schema = JSON.parse(readFileSync(cfg.eventSchema, "utf8"));
  const { ok, errors } = validateEvent(event, schema);
  if (!ok) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  const dir = join(outDir, event.round);
  const tsFile = event.ts.replaceAll(":", "-");
  const base = `${tsFile}__${scopeToken(event)}__${event.kind}`;

  if (dryRun) {
    console.log(availablePath(dir, base));
    return;
  }

  const content = JSON.stringify(event, null, 2) + "\n";
  console.log(writeEventFile(dir, base, content));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
