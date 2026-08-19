// Adapted from the monorepo's scripts/governance/lib/worktree.mjs (R15 / §4 of the extraction
// instruction). The monorepo original hardlinks a donor repo's web-app node_modules and copies
// its .env.local into every worktree it provisions — both are monorepo-specific and neither ships
// here. This module is the generic half only: `git worktree add`, nothing else.
// gate-compare.mjs's default (--no-worktree) does not call this at all; --worktree is the opt-in
// that does. A flag that silently did the wrong thing (skip provisioning and pretend it worked)
// would be worse than a flag that stays this narrow.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr.trim());
  }
  return result.stdout.trim();
}

const safe = (value) => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "");

export function resolveRef(repo, ref) {
  return git(["rev-parse", ref], repo);
}

// No provisioning: no node_modules donor, no .env.local. A gate whose command needs either must
// say so in its own `cmd` (e.g. "npm ci && npm test") — this module only creates the worktree.
export function prepareWorktree({ repo, ref, root }) {
  const sha = resolveRef(repo, ref);
  const path = join(root, `${safe(ref)}-${sha.slice(0, 8)}`);
  if (existsSync(path)) {
    let current;
    try { current = git(["rev-parse", "HEAD"], path); } catch { current = null; }
    if (current !== sha) {
      git(["worktree", "remove", "--force", path], repo);
      rmSync(path, { recursive: true, force: true });
    }
  }
  if (!existsSync(path)) {
    mkdirSync(root, { recursive: true });
    git(["worktree", "add", "--detach", path, sha], repo);
  }
  return { path, sha, label: basename(path) };
}

export function removeWorktree({ repo, path }) {
  try { git(["worktree", "remove", "--force", path], repo); } catch { /* best-effort cleanup */ }
  rmSync(path, { recursive: true, force: true });
}

// require a clean tree before an in-place base-ref checkout (the --no-worktree default path).
export function assertCleanWorktree(repo) {
  const status = git(["status", "--porcelain"], repo);
  if (status) {
    throw new Error(
      "refusing a base-ref comparison against a dirty working tree (--no-worktree is the default; " +
        "commit or stash your changes, or pass --worktree to compare in isolated git worktrees instead)",
    );
  }
}

// In-place checkout used by the --no-worktree default: caller is responsible for restoring HEAD
// via checkoutRef(repo, originalRef) afterwards.
export function checkoutRef(repo, ref) {
  git(["checkout", "--detach", ref], repo);
}
