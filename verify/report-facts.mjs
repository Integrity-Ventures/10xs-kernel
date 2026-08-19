// scripts/governance/lib/report-facts.mjs
//
// Shared measurement + parsing primitives for harvest.mjs (the measurer) and
// report-gate.mjs (the validator). Neither tool measures anything on its own
// - every git call, every file read, every hash lives here, so the two tools
// cannot silently drift apart in HOW they measure the same fact.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
export const NARRATIVE_HEADING = '## Executor narrative (unverified claim)';
export const NARRATIVE_BOILERPLATE_LINES = [
  'Everything below this heading is prose the executor writes; report-gate.mjs treats it as',
  'an unverified claim, never as a fact to be checked.',
];
export const TEST_CLAIM_PHRASES = [
  'tests passed', 'tests:', 'test suites:', '# pass', '# tests', 'passing', 'all tests pass', '✓',
];
export const PASS_CLAIM_PHRASES = ['tests passed', 'all tests pass', 'passing', '✓'];
// Requires at least one a-f letter so a plain decimal count (a byte count, a
// line count) - also a valid string of hex digits - can never match.
export const SHA_TOKEN_RE = /\b(?=[0-9a-fA-F]*[a-fA-F])[0-9a-fA-F]{7,40}\b/g;
function git(repo, args) {
  return spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
export function gitRevParse(repo, ref) {
  const res = git(repo, ['rev-parse', ref]);
  if (res.status !== 0) throw new Error(`git rev-parse ${ref} failed: ${res.stderr || res.error?.message}`);
  return res.stdout.trim();
}
export function gitAbbrevRef(repo) {
  const res = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (res.status !== 0) throw new Error(`git rev-parse --abbrev-ref HEAD failed: ${res.stderr}`);
  return res.stdout.trim();
}
export function gitDiffNameStatus(repo, base, head) {
  const res = git(repo, ['diff', '--name-status', `${base}..${head}`]);
  if (res.status !== 0) throw new Error(`git diff --name-status failed: ${res.stderr}`);
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const fields = line.split('\t');
      return { status: fields[0][0], path: fields[fields.length - 1] };
    });
}
export function resolvesToCommit(repo, sha) {
  const res = git(repo, ['cat-file', '-t', sha]);
  return res.status === 0 && res.stdout.trim() === 'commit';
}
export function readFileAtRef(repo, ref, path) {
  const res = git(repo, ['show', `${ref}:${path}`]);
  return res.status === 0 ? res.stdout : null;
}
export function measureText(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  return { lines: lines.length, longest_line: longest };
}
export function measureFileAtRef(repo, ref, path) {
  const text = readFileAtRef(repo, ref, path);
  return text === null ? null : measureText(text);
}
export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}
export function isPathInsideRepo(repoRoot, outPath) {
  const rel = relative(resolve(repoRoot), resolve(outPath));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
// Combined stdout+stderr is captured by shell redirection INSIDE the executed
// command string itself (never by separately buffering node-side streams), so
// the real interleave order of a test run is preserved.
export function runCapturedCommand(command, cwd, outputPath) {
  const shell = `{ ${command} ; } > ${shQuote(outputPath)} 2>&1`;
  const res = spawnSync('/bin/sh', ['-c', shell], { cwd });
  return { exitCode: res.status === null ? 1 : res.status };
}
export function extractHexTokens(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    const re = new RegExp(SHA_TOKEN_RE.source, 'g');
    let m;
    while ((m = re.exec(line))) out.push({ value: m[0], lineNo: i + 1, line });
  });
  return out;
}
export function extractLabeledSha(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^-\s*(head|base)\s+sha:\s*([0-9a-fA-F]+)\s*$/i);
    if (m) out.push({ label: m[1].toLowerCase(), sha: m[2], lineNo: i + 1, line });
  });
  return out;
}
export function extractChangedFileClaims(text) {
  const out = [];
  const re = /^-\s+(\S+)\s+status=(\S)\s+lines=(null|\d+)\s+max=(null|\d+)\s*$/;
  text.split('\n').forEach((line, i) => {
    const m = line.match(re);
    if (!m) return;
    out.push({
      path: m[1],
      status: m[2],
      lines: m[3] === 'null' ? null : Number(m[3]),
      longest_line: m[4] === 'null' ? null : Number(m[4]),
      lineNo: i + 1,
      line,
    });
  });
  return out;
}
export function findSubstitutionOccurrences(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const token of ['$(', '${']) {
      let idx = line.indexOf(token);
      while (idx !== -1) {
        out.push({ token, lineNo: i + 1, line });
        idx = line.indexOf(token, idx + 1);
      }
    }
  });
  return out;
}
// Blanks fenced ``` blocks, preserving line numbers. stripInlineSpans (opt-in,
// default false) also blanks `...` inline spans: RG001 needs it, RG002 must not.
export function fenceMaskLines(text, { stripInlineSpans = false } = {}) {
  let inFence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return '';
      }
      if (inFence) return '';
      return stripInlineSpans ? line.replace(/`[^`]*`/g, '') : line;
    })
    .join('\n');
}
export function splitAtNarrativeHeading(text) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => l.trim() === NARRATIVE_HEADING);
  if (idx === -1) return { factual: text, narrative: '', hasHeading: false };
  return {
    factual: lines.slice(0, idx).join('\n'),
    narrative: lines.slice(idx + 1).join('\n'),
    hasHeading: true,
  };
}
export function containsPhrase(text, phrases) {
  const lower = text.toLowerCase();
  return phrases.filter((p) => lower.includes(p.toLowerCase()));
}

function fileLine(f) {
  const lines = f.lines === null ? 'null' : f.lines;
  const max = f.longest_line === null ? 'null' : f.longest_line;
  return `- ${f.path} status=${f.status} lines=${lines} max=${max}`;
}
function testLines(test) {
  if (test === null) return ['- test: not run (no --test-cmd given to harvest.mjs)'];
  return [
    `- command: ${test.command}`,
    `- exit code: ${test.exit_code}`,
    `- output path: ${test.output_path}`,
    `- output sha256: ${test.output_sha256}`,
    `- output bytes: ${test.output_bytes}`,
  ];
}
export function renderReportSkeleton(facts) {
  return [
    `# Report facts — MT ${facts.mt_id}`,
    '',
    `- repo: ${facts.repo}`,
    `- branch: ${facts.branch}`,
    `- head sha: ${facts.head_sha}`,
    `- base sha: ${facts.base_sha}`,
    '',
    '## Changed files',
    '',
    ...facts.changed_files.map(fileLine),
    '',
    '## Test',
    '',
    ...testLines(facts.test),
    '',
    'Everything above this line was measured by harvest.mjs - do not hand-edit it.',
    '',
    NARRATIVE_HEADING,
    '',
    ...NARRATIVE_BOILERPLATE_LINES,
    '',
  ].join('\n');
}
