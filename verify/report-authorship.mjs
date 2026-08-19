// Fold-time half of the report-authorship guard. House doctrine: the one who does the work writes
// the completion report. A lane's `pushed` event names the report it wrote and the sha it wrote
// it at (claim.report_path, subject.sha) — this compares that blob, byte for byte via git, against
// the same path at fold. Identical: the report stood. Different: someone edited it after the fact.
//
// Adapted from the monorepo's scripts/governance/lib/report-authorship.mjs: REPORTS_PREFIX was
// derived there from an imported constant (REPORT_ADVANCE_PREFIXES[0]); here it is a parameter
// (config.reportPrefixes[0]) resolved once by the caller and passed down.
import { spawnSync } from "node:child_process";

function git(repo, args) {
  return spawnSync("git", args, { cwd: repo, encoding: "utf8" });
}

// null means "not present at this sha" (missing file or unresolvable sha) — both are findings.
function blobAt(repo, sha, path) {
  if (!sha) return null;
  const result = git(repo, ["show", `${sha}:${path}`]);
  return result.status === 0 ? result.stdout : null;
}

function reportPathOf(event, reportsPrefix) {
  const path = event.claim?.report_path ?? event.claim?.report ?? null;
  return path && path.startsWith(reportsPrefix) ? path : null;
}

function finding(event, path, reason, foldSha) {
  return {
    mt_id: event?.mt_id ?? null,
    report_path: path,
    reason,
    pushed_sha: event?.subject?.sha ?? null,
    fold_sha: foldSha,
  };
}

// A lane can legitimately push the same report path twice (a second pass, a small fix after
// review). "Most recent" is by event.ts (ISO-8601, so lexicographic = chronological) — see the
// monorepo original for the full ts-vs-ancestry trade-off discussion this preserves unchanged.
function latestPushedByPath(events, reportsPrefix) {
  const latest = new Map();
  for (const event of events) {
    if (event.kind !== "pushed") continue;
    const path = reportPathOf(event, reportsPrefix);
    if (!path) continue;
    const prior = latest.get(path);
    if (!prior || (event.ts ?? "") >= (prior.ts ?? "")) latest.set(path, event);
  }
  return latest;
}

// D1: bound every check to reports this round actually introduced. null baseSha (unbounded) is
// identical to pre-D1 behavior — e.g. an isolated test fixture with no origin remote.
function addedSincePaths(repo, baseSha, foldSha, prefix) {
  if (!baseSha) return null;
  const result = git(repo, ["diff", "--name-only", "--diff-filter=AM", baseSha, foldSha, "--", prefix]);
  return result.status === 0 ? new Set(result.stdout.trim().split("\n").filter(Boolean)) : null;
}

// repo: git working directory. foldSha: the fold's resolved commit. events: parsed event objects
// (assert-fold.mjs already loads these; reused here, not re-read from disk). baseSha: optional —
// bounds scope to reports added since this sha (D1). reportsPrefix: config.reportPrefixes[0].
export function reportAuthorshipFindings(repo, foldSha, events, baseSha, reportsPrefix) {
  const findings = [];
  const claimedPaths = new Set();
  const inScope = addedSincePaths(repo, baseSha, foldSha, reportsPrefix);

  for (const event of events) {
    if (event.kind === "pushed" && reportPathOf(event, reportsPrefix)) {
      claimedPaths.add(reportPathOf(event, reportsPrefix));
    }
  }

  for (const event of latestPushedByPath(events, reportsPrefix).values()) {
    const path = reportPathOf(event, reportsPrefix);
    if (inScope && !inScope.has(path)) continue;

    const atPush = blobAt(repo, event.subject?.sha, path);
    if (atPush === null) {
      findings.push(finding(event, path, `claimed at pushed sha ${event.subject?.sha} but not present there`, foldSha));
      continue;
    }
    const atFold = blobAt(repo, foldSha, path);
    if (atFold === null) {
      findings.push(finding(event, path, "present at the pushed sha, absent at fold", foldSha));
    } else if (atPush !== atFold) {
      findings.push(finding(event, path, "changed after the pushed sha (fold content differs byte for byte)", foldSha));
    }
  }

  const tree = git(repo, ["ls-tree", "-r", "--name-only", foldSha, "--", reportsPrefix]);
  const atFoldPaths = tree.status === 0 ? tree.stdout.trim().split("\n").filter(Boolean) : [];
  for (const path of atFoldPaths) {
    if (inScope && !inScope.has(path)) continue;
    if (path.endsWith("_report.md") && !claimedPaths.has(path)) {
      findings.push(finding(null, path, "present at fold with no pushed event claiming it", foldSha));
    }
  }

  return findings;
}
