#!/usr/bin/env node
// scripts/governance/harvest.mjs
//
// Measures the facts a completion report is allowed to state: which files
// changed, how big they are, and what a test run's exit code and captured
// output actually were. Every field in report-facts.json comes from a git
// call or a captured command THIS script ran itself - never from anything
// an executor typed. See lib/report-facts.mjs for the primitives and
// report-gate.mjs for the tool that checks a report against this file.
//
//   node scripts/governance/harvest.mjs --repo <path> --mt-id <id> \
//        --base <ref> [--test-cmd "<shell command>"] [--test-cwd <path>] \
//        --out <dir outside the repo>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  gitAbbrevRef,
  gitDiffNameStatus,
  gitRevParse,
  isPathInsideRepo,
  measureFileAtRef,
  renderReportSkeleton,
  runCapturedCommand,
  sha256Hex,
} from './report-facts.mjs';
import { blobDigestAtRef } from './blob-digest.mjs';

const USAGE =
  'Usage: harvest.mjs --repo <path> --mt-id <id> --base <ref> ' +
  '[--test-cmd "<shell command>"] [--test-cwd <path>] --out <dir outside the repo>';

function parseArgs(argv) {
  const opts = { repo: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--mt-id') opts.mtId = argv[++i];
    else if (a === '--base') opts.base = argv[++i];
    else if (a === '--test-cmd') opts.testCmd = argv[++i];
    else if (a === '--test-cwd') opts.testCwd = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else {
      console.error(`unrecognized argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function validate(opts) {
  if (!opts.mtId || !opts.base || !opts.out) {
    console.error(USAGE);
    process.exit(1);
  }
  if (opts.testCwd !== undefined && /^\s*cd(?:\s|$)/.test(opts.testCmd ?? '')) {
    console.error(
      `Refusing leading cd in --test-cmd ${JSON.stringify(opts.testCmd)} with ` +
      `explicit --test-cwd ${JSON.stringify(opts.testCwd)}; drop one of these options.`,
    );
    process.exit(1);
  }
  const repo = resolve(opts.repo);
  const testCwd = opts.testCwd ? resolve(repo, opts.testCwd) : repo;
  if (!isPathInsideRepo(repo, testCwd)) {
    console.error(`Refusing --test-cwd outside the repo working tree: ${opts.testCwd}`);
    process.exit(1);
  }
  if (!existsSync(testCwd)) {
    console.error(`Refusing missing --test-cwd: ${opts.testCwd}`);
    process.exit(1);
  }
  if (isPathInsideRepo(repo, opts.out)) {
    console.error(`Refusing to write inside the repo working tree: ${opts.out}`);
    console.error('Harvest output is measurement, not source - pass an --out path outside the repo.');
    process.exit(1);
  }
  return { repo, testCwd };
}

function measureChangedFiles(repo, baseSha, headSha) {
  return gitDiffNameStatus(repo, baseSha, headSha).map(({ status, path }) => {
    if (status === 'D') return { path, status, lines: null, longest_line: null, sha256: null };
    const measured = measureFileAtRef(repo, headSha, path);
    return {
      path,
      status,
      lines: measured ? measured.lines : null,
      longest_line: measured ? measured.longest_line : null,
      sha256: blobDigestAtRef(repo, headSha, path),
    };
  });
}

function runTest(testCwd, testCmd, outDir) {
  if (!testCmd) return null;
  const outputPath = join(outDir, 'test-output.txt');
  const { exitCode } = runCapturedCommand(testCmd, testCwd, outputPath);
  const bytes = readFileSync(outputPath);
  return {
    command: testCmd,
    cwd: testCwd,
    exit_code: exitCode,
    output_path: outputPath,
    output_sha256: sha256Hex(bytes),
    output_bytes: bytes.length,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { repo, testCwd } = validate(opts);
  const out = resolve(opts.out);
  mkdirSync(out, { recursive: true });

  const branch = gitAbbrevRef(repo);
  const headSha = gitRevParse(repo, 'HEAD');
  const baseSha = gitRevParse(repo, opts.base);

  const facts = {
    schema: '10xs.report-facts/1',
    generated_ts: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    repo,
    mt_id: opts.mtId,
    branch,
    head_sha: headSha,
    base_sha: baseSha,
    changed_files: measureChangedFiles(repo, baseSha, headSha),
    test: runTest(testCwd, opts.testCmd, out),
  };

  const factsPath = join(out, 'report-facts.json');
  writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
  writeFileSync(join(out, 'report-skeleton.md'), renderReportSkeleton(facts));
  console.log(factsPath);
}

main();
