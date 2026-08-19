#!/usr/bin/env node
// scripts/governance/report-gate.mjs
//
// Refuses a completion report whose facts do not survive re-measurement.
// An executor report that fails this gate is deleted and regenerated from
// report-skeleton.md plus a fresh narrative - it is not patched, and its
// failing claims are never edited into agreement: a report that had to be
// argued into truth is not evidence.
//
//   node scripts/governance/report-gate.mjs --report <path to *_report.md> \
//        --facts <path to report-facts.json> [--repo <path>] [--allow-stale]
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PASS_CLAIM_PHRASES, TEST_CLAIM_PHRASES, containsPhrase,
  extractHexTokens, extractLabeledSha, fenceMaskLines, findSubstitutionOccurrences,
  gitRevParse, resolvesToCommit, sha256Hex, splitAtNarrativeHeading,
} from './report-facts.mjs';
import { reportCommitAllowance } from './report-commit-allowance.mjs';
import { HELP } from './report-gate-help.mjs';
import { checkRG008 } from './report-narrative.mjs';
import { checkRG004 } from './report-self-claim.mjs';

function finding(code, file, message, line) {
  return line === undefined ? { code, file, message } : { code, file, line, message };
}

function parseArgs(argv) {
  const opts = { allowStale: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help') {
      console.log(HELP);
      process.exit(0);
    } else if (a === '--report') opts.report = argv[++i];
    else if (a === '--facts') opts.facts = argv[++i];
    else if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--allow-stale') opts.allowStale = true;
    else {
      console.error(`unrecognized argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function loadInputs(opts) {
  if (!opts.report || !opts.facts) {
    console.error(HELP);
    process.exit(2);
  }
  if (!existsSync(opts.report)) {
    console.error(`--report path does not exist: ${opts.report}`);
    process.exit(2);
  }
  if (!existsSync(opts.facts)) {
    console.error(`--facts path does not exist: ${opts.facts}`);
    process.exit(2);
  }
  const reportText = readFileSync(opts.report, 'utf8');
  let facts;
  try {
    facts = JSON.parse(readFileSync(opts.facts, 'utf8'));
  } catch (err) {
    console.error(`--facts is not valid JSON: ${err.message}`);
    process.exit(2);
  }
  return { reportText, facts, repo: resolve(opts.repo || process.cwd()) };
}

function walkStrings(value, cb) {
  if (typeof value === 'string') cb(value);
  else if (Array.isArray(value)) value.forEach((v) => walkStrings(v, cb));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => walkStrings(v, cb));
}

function checkRG001(reportText, facts, file) {
  const out = [];
  walkStrings(facts, (s) => {
    if (s.includes('$(') || s.includes('${')) {
      out.push(finding('RG001', 'report-facts.json', `unexpanded substitution in facts value: ${s}`));
    }
  });
  for (const occ of findSubstitutionOccurrences(fenceMaskLines(reportText, { stripInlineSpans: true }))) {
    const msg = `unexpanded substitution outside a fenced block: ${occ.line.trim()}`;
    out.push(finding('RG001', file, msg, occ.lineNo));
  }
  return out;
}
function checkRG002(factual, facts, repo, file) {
  // Fence-only masking (no stripInlineSpans): a sha typed inside inline
  // backticks in ordinary prose must still be caught. See fenceMaskLines'
  // doc comment in report-facts.mjs.
  const shas = new Set(extractHexTokens(fenceMaskLines(factual)).map((t) => t.value));
  if (facts.head_sha) shas.add(facts.head_sha);
  if (facts.base_sha) shas.add(facts.base_sha);
  return [...shas]
    .filter((sha) => !resolvesToCommit(repo, sha))
    .map((sha) => finding('RG002', file, `sha does not resolve to a commit in ${repo}: ${sha}`));
}
function checkRG003(factual, facts, repo, file) {
  const out = [];
  for (const { label, sha, lineNo, line } of extractLabeledSha(factual)) {
    const expected = label === 'head' ? facts.head_sha : facts.base_sha;
    if (sha === expected) continue;
    if (label === 'head') {
      const allowance = reportCommitAllowance(repo, sha, expected);
      if (allowance.allowed) {
        const paths = allowance.paths.join(', ');
        console.error(
          `[RG003 ALLOWED report-commit advance] report head=${sha.slice(0, 7)} is an ancestor of `
          + `facts.head_sha=${expected.slice(0, 7)};\n  ${allowance.commits} commit(s) between them touch only `
          + `report/event paths: ${paths}`,
        );
        continue;
      }
      const msg = `${line.trim()} - facts.json says ${label}_sha=${expected} (report says ${sha}); `
        + allowance.reason;
      out.push(finding('RG003', file, msg, lineNo));
      continue;
    }
    const msg = `${line.trim()} - facts.json says ${label}_sha=${expected} (report says ${sha})`;
    out.push(finding('RG003', file, msg, lineNo));
  }
  return out;
}
function checkRG005(reportText, facts, file) {
  const matched = containsPhrase(reportText, TEST_CLAIM_PHRASES);
  if (!matched.length) return [];
  const phrases = matched.join(', ');
  if (!facts.test || !facts.test.output_path) {
    return [finding('RG005', file, `test claim (${phrases}) but facts.test is null/has no output_path`)];
  }
  let bytes;
  try {
    bytes = readFileSync(facts.test.output_path);
  } catch {
    const msg = `test claim (${phrases}) but output_path unreadable: ${facts.test.output_path}`;
    return [finding('RG005', file, msg)];
  }
  if (sha256Hex(bytes) !== facts.test.output_sha256) {
    const msg = `test claim (${phrases}) but captured output sha256 does not match facts.json`;
    return [finding('RG005', file, msg)];
  }
  return [];
}
function checkRG006(reportText, facts, file) {
  const matched = containsPhrase(reportText, PASS_CLAIM_PHRASES);
  if (!matched.length || !facts.test || facts.test.exit_code === 0) return [];
  const msg = `pass claim (${matched.join(', ')}) but facts.test.exit_code=${facts.test.exit_code}`;
  return [finding('RG006', file, msg)];
}
function checkRG007(facts, repo, allowStale) {
  const freshHead = gitRevParse(repo, 'HEAD');
  if (freshHead === facts.head_sha) return [];
  if (allowStale) {
    console.error(`[RG007 SUPPRESSED by --allow-stale] facts.head_sha=${facts.head_sha} fresh HEAD=${freshHead}`);
    return [];
  }
  const allowance = reportCommitAllowance(repo, facts.head_sha, freshHead);
  if (allowance.allowed) {
    console.error(
      `[RG007 ALLOWED report-commit advance] facts.head_sha=${facts.head_sha.slice(0, 7)} is an ancestor of `
      + `fresh HEAD=${freshHead.slice(0, 7)};\n  ${allowance.commits} commit(s) between them touch only `
      + `report/event paths: ${allowance.paths.join(', ')}`,
    );
    return [];
  }
  const message = `facts.head_sha=${facts.head_sha} but fresh HEAD=${freshHead}; ${allowance.reason}`;
  return [finding('RG007', 'report-facts.json', message)];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { reportText, facts, repo } = loadInputs(opts);
  const { factual } = splitAtNarrativeHeading(reportText);
  const file = opts.report;

  const findings = [
    ...checkRG001(reportText, facts, file),
    ...checkRG002(factual, facts, repo, file),
    ...checkRG003(factual, facts, repo, file),
    ...checkRG004(factual, repo, file),
    ...checkRG005(reportText, facts, file),
    ...checkRG006(reportText, facts, file),
    ...checkRG007(facts, repo, opts.allowStale),
    ...checkRG008(reportText, file),
  ];

  for (const f of findings) {
    console.error(`[${f.code}] ${f.file}${f.line ? `:${f.line}` : ''}: ${f.message}`);
  }
  if (!findings.length) console.log(`report-gate: clean - ${file}`);
  process.exit(findings.length ? 1 : 0);
}

main();
