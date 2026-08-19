#!/usr/bin/env node
// Adapted from the monorepo's scripts/governance/gate-compare.mjs (R15 / §4). The monorepo
// original defaults to a hardlinked, .env.local-provisioned worktree rooted at
// /home/ubuntu/gate-runs, donor /home/ubuntu/10xs-ai-website. Neither ships: the OSS default is
// --no-worktree (measure the working tree as it stands, require a clean tree to check out a base
// ref for comparison); --worktree is an opt-in generic `git worktree add`, no hardlinking.
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runGates } from "./gates.mjs";
import { compareGates, renderComparisons } from "./compare.mjs";
import { emitGateEvent } from "./emit-gate-event.mjs";
import { prepareWorktree, assertCleanWorktree, checkoutRef, restoreRef, resolveRef } from "./worktree.mjs";
import { loadConfig } from "./config.mjs";

function options(argv, cfg) {
  const out = { only: Object.keys(cfg.gates), worktreeRoot: ".10xs/gate-runs", useWorktree: false,
    eventDir: cfg.eventsDir, event: true };
  const names = { "--base": "base", "--head": "head", "--worktree-root": "worktreeRoot",
    "--round": "round", "--mt-id": "mtId", "--event-dir": "eventDir", "--json": "json",
    "--actor-model": "actorModel", "--actor-machine": "actorMachine", "--actor-role": "actorRole" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--no-event") out.event = false;
    else if (argv[i] === "--worktree") out.useWorktree = true;
    else if (argv[i] === "--no-worktree") out.useWorktree = false;
    else if (argv[i] === "--only") out.only = argv[++i].split(",");
    else if (names[argv[i]]) out[names[argv[i]]] = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!out.base) throw new Error("--base is required");
  if (out.event && !out.round) throw new Error("--round is required unless --no-event (null mt_id event filenames use the scope token)");
  if (out.round && !/^[0-9]{8}-[a-z0-9][a-z0-9-]*$/.test(out.round)) throw new Error(`invalid --round: ${out.round}`);
  const invalid = out.only.filter((name) => !cfg.gates[name]);
  if (invalid.length) throw new Error(`unknown gate(s) (not in config.gates): ${invalid.join(",")}`);
  return out;
}

const observed = (comparisons) => Object.fromEntries(comparisons.flatMap((item) => {
  const prefix = item.name.replace("-", "_");
  return Object.keys(item.base.counts).map((key) => [`${prefix}_${key}`, `${item.base.counts[key]}=${item.head.counts[key]}`]);
}));

function runWithWorktree(repo, cfg, args) {
  const root = resolve(args.worktreeRoot);
  const base = prepareWorktree({ repo, ref: args.base, root });
  const head = prepareWorktree({ repo, ref: args.head || "HEAD", root });
  console.log(`base ${args.base} -> ${base.sha} (${base.path})`);
  console.log(`head ${args.head || "HEAD"} -> ${head.sha} (${head.path})`);
  return { baseSha: base.sha, headSha: head.sha,
    baseGates: runGates(base.path, cfg.gates, args.only), headGates: runGates(head.path, cfg.gates, args.only) };
}

function runInPlace(repo, cfg, args) {
  if (args.head && args.head !== "HEAD") {
    throw new Error("--no-worktree can only measure the current HEAD as head; pass --worktree to compare two arbitrary refs");
  }
  assertCleanWorktree(repo);
  const headSha = resolveRef(repo, "HEAD");
  console.log(`head HEAD -> ${headSha} (working tree)`);
  const headGates = runGates(repo, cfg.gates, args.only);
  let originalRef;
  try { originalRef = execFileSync("git", ["symbolic-ref", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(); }
  catch { originalRef = headSha; }
  const baseSha = resolveRef(repo, args.base);
  checkoutRef(repo, args.base);
  console.log(`base ${args.base} -> ${baseSha} (working tree, checked out in place)`);
  let baseGates;
  try { baseGates = runGates(repo, cfg.gates, args.only); } finally { restoreRef(repo, originalRef); }
  return { baseSha, headSha, baseGates, headGates };
}

try {
  const cfg = loadConfig(resolve(process.cwd()));
  const args = options(process.argv.slice(2), cfg);
  const repo = process.cwd();
  const { baseSha, headSha, baseGates, headGates } = args.useWorktree
    ? runWithWorktree(repo, cfg, args) : runInPlace(repo, cfg, args);
  const comparisons = compareGates(baseGates, headGates);
  console.log(`\n${renderComparisons(comparisons)}`);
  const payload = { base: { ref: args.base, sha: baseSha, gates: baseGates },
    head: { ref: args.head || "HEAD", sha: headSha, gates: headGates }, comparisons };
  if (args.json) {
    writeFileSync(args.json, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\nJSON: ${args.json}`);
  }
  if (args.event) {
    const emitted = emitGateEvent({ eventDir: resolve(args.eventDir), round: args.round, mtId: args.mtId,
      headRef: args.head || "HEAD", headSha, baseSha, observed: observed(comparisons),
      actorModel: args.actorModel, actorMachine: args.actorMachine, actorRole: args.actorRole, project: cfg.project });
    const status = emitted.schemaValidated ? "schema validated" : "schema absent; validation skipped";
    console.log(`\nEvent: ${emitted.path} (${status})`);
  }
  process.exitCode = comparisons.some((item) => item.broken || item.regression) ? 1 : 0;
} catch (error) {
  console.error(`gate-compare: ${error.message}`);
  process.exitCode = 2;
}
