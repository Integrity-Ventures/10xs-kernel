// Adapted from the monorepo's scripts/governance/lib/evidence-at-fold.mjs: EVIDENCE_PREFIX and
// INSTRUCTIONS_PREFIX were module-level constants there; here they are parameters (from
// config.evidencePrefix / config.instructionsPrefix), resolved once by the caller.
import { basename } from "node:path";
import { spawnSync } from "node:child_process";

function git(repo, args) {
  return spawnSync("git", args, { cwd: repo, encoding: "utf8" });
}
function pathsFrom(result) {
  return result.stdout.trim().split("\n").filter(Boolean);
}

function resolvable(repo, sha) {
  if (!sha) return false;
  return git(repo, ["rev-parse", "--verify", `${sha}^{commit}`]).status === 0;
}
function evidenceCriterion(instruction, evidencePrefix) {
  const lines = instruction.split("\n");
  const start = lines.findIndex((line) => /^#{1,6}\s+.*success criteria/i.test(line));
  if (start < 0) return null;
  const depth = lines[start].match(/^#+/)[0].length;
  const end = lines.findIndex((line, index) => index > start
    && new RegExp(`^#{1,${depth}}\\s+`).test(line));
  const section = lines.slice(start + 1, end < 0 ? undefined : end);
  // Only checkboxes inside Success Criteria count: constraints may prohibit committing evidence.
  return section.find((line) => /^\s*[-*]\s+\[[ xX]\]/.test(line)
    && line.includes(evidencePrefix))?.trim() ?? null;
}

function latestPushedByMtId(entries) {
  const latest = new Map();
  for (const entry of entries) {
    const event = entry.event;
    if (event.kind !== "pushed" || typeof event.mt_id !== "string" || !event.mt_id.trim()) continue;
    const prior = latest.get(event.mt_id);
    if (!prior || (event.ts ?? "") >= (prior.event.ts ?? "")) latest.set(event.mt_id, entry);
  }
  return latest;
}

function finding(event, instructionPath, criterion, reason) {
  return {
    mt_id: event.mt_id,
    instruction_path: instructionPath,
    criterion,
    pushed_sha: event.subject?.sha ?? null,
    reason,
  };
}

export function evidenceAtFoldFindings(repo, foldSha, entries, baseSha, evidencePrefix, instructionsPrefix, eventsDir) {
  const findings = [], notes = [];
  let scopedEntries = entries;
  if (baseSha) {
    const diff = git(repo, ["diff", "--name-only", "--diff-filter=AM", baseSha, foldSha, "--", eventsDir]);
    if (diff.status === 0) {
      const introduced = new Set(pathsFrom(diff));
      scopedEntries = entries.filter((entry) => introduced.has(entry.path));
    }
  }

  const tree = git(repo, ["ls-tree", "-r", "--name-only", foldSha, "--", instructionsPrefix]);
  const instructionPaths = tree.status === 0 ? pathsFrom(tree) : [];
  for (const { event } of latestPushedByMtId(scopedEntries).values()) {
    const matches = instructionPaths.filter((path) => basename(path).startsWith(`${event.mt_id}_`));
    if (matches.length === 0) {
      notes.push(`[f] SKIP ${event.mt_id}: no instruction file found`);
      continue;
    }
    if (matches.length > 1) {
      notes.push(`[f] SKIP ${event.mt_id}: ambiguous instruction files: ${matches.join(", ")}`);
      continue;
    }
    const instructionPath = matches[0];
    const blob = git(repo, ["show", `${foldSha}:${instructionPath}`]);
    const criterion = blob.status === 0 ? evidenceCriterion(blob.stdout, evidencePrefix) : null;
    if (!criterion) continue;

    const sha = event.subject?.sha;
    if (!resolvable(repo, sha)) {
      findings.push(finding(event, instructionPath, criterion,
        `pushed sha ${sha ?? "absent"} is not resolvable, so lane evidence cannot be verified`));
      continue;
    }
    const eventBase = event.subject?.base_sha;
    const laneBase = resolvable(repo, eventBase) ? eventBase : baseSha;
    const evidence = laneBase
      ? git(repo, ["diff", "--name-only", "--diff-filter=AM", laneBase, sha, "--", evidencePrefix])
      : git(repo, ["ls-tree", "-r", "--name-only", sha, "--", evidencePrefix]);
    if (evidence.status !== 0 || pathsFrom(evidence).length === 0) {
      findings.push(finding(event, instructionPath, criterion,
        `instruction demands committed evidence but the lane branch adds no files under ${evidencePrefix}`));
    }
  }
  return { findings, notes };
}
