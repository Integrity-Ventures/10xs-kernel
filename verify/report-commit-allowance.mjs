// These git calls are topology predicates only the validator asks; they are not facts stated in a
// report, so keeping them here cannot make harvest and the gate drift in how they measure a fact.
//
// Adapted from the monorepo's scripts/governance/lib/report-commit-allowance.mjs: the prefix list
// was a hardcoded constant (REPORT_ADVANCE_PREFIXES) there; here it is a parameter sourced from
// verify/config.mjs's `reportPrefixes`, never re-read from disk in this leaf module.
import { spawnSync } from "node:child_process";

function git(repo, args) {
  return spawnSync("git", args, { cwd: repo, encoding: "utf8" });
}

function resolveCommit(repo, sha) {
  const result = git(repo, ["rev-parse", "--verify", `${sha}^{commit}`]);
  return result.status === 0 ? result.stdout.trim() : null;
}

export function reportCommitAllowance(repo, reportedHead, factsHead, reportPrefixes) {
  const reportedCommit = resolveCommit(repo, reportedHead);
  if (!reportedCommit) {
    return { allowed: false, reason: `${reportedHead} does not resolve`, commits: 0, paths: [] };
  }
  const factsCommit = resolveCommit(repo, factsHead);
  if (!factsCommit) {
    return { allowed: false, reason: `${factsHead} does not resolve`, commits: 0, paths: [] };
  }
  if (reportedCommit === factsCommit) {
    return { allowed: true, reason: "same commit", commits: 0, paths: [] };
  }
  const ancestor = git(repo, ["merge-base", "--is-ancestor", reportedCommit, factsCommit]);
  if (ancestor.status !== 0) {
    return { allowed: false, reason: "not an ancestor of facts.head_sha", commits: 0, paths: [] };
  }
  const range = `${reportedCommit}..${factsCommit}`;
  const diff = git(repo, ["diff", "--name-only", "--no-renames", range]);
  const paths = diff.status === 0 ? diff.stdout.trim().split("\n").filter(Boolean) : [];
  const offending = paths.filter((path) => !reportPrefixes.some((prefix) => path.startsWith(prefix)));
  if (!paths.length || offending.length) {
    const reason = !paths.length
      ? "advance has no changed paths"
      : `advance touches non-report paths: ${offending.join(", ")}`;
    return { allowed: false, reason, commits: 0, paths };
  }
  const count = git(repo, ["rev-list", "--count", range]);
  const commits = count.status === 0 ? Number.parseInt(count.stdout.trim(), 10) : 0;
  return { allowed: true, reason: "report/event paths only", commits, paths };
}
