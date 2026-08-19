// The OSS half of the monorepo's scripts/governance/lib/gates.mjs split (R15): this keeps the
// comparison machinery (member SETS, not counts — see compare.mjs, moved verbatim) and ships four
// generic output parsers. The runners that only meant something inside the 10xs monorepo —
// check-files, lambda, build, ssr-content — do not ship; ssr-content cannot, since it imports
// the host web app directly. A gate names its own command, cwd and parser in config; an unknown
// parser is a clear error naming the four, never a silent skip.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

export const PARSER_NAMES = ["exit-code", "jest-json", "eslint-json", "tsc"];

function shell(cmd, cwd) {
  const res = spawnSync(cmd, { cwd, encoding: "utf8", maxBuffer: 100 * 1024 * 1024, shell: true });
  return { status: res.status, output: `${res.stdout || ""}${res.stderr || ""}`, error: res.error };
}

const broken = (name, reason, counts = {}, members = {}) => ({ name, ok: false, broken: true, brokenReason: reason, counts, members });
const result = (name, ok, counts, members) => ({ name, ok, broken: false, brokenReason: null, counts, members });
const rel = (root, path) => relative(root, path).replaceAll("\\", "/");
const spawnReason = (run) => (run.error ? run.error.message : run.status === null ? "command could not execute" : null);

const jestTestTitle = (cwd, suite, assertion) => `${rel(cwd, suite.name)}|${[...assertion.ancestorTitles, assertion.title].join(" > ")}`;
export function failingJestTests(data, cwd) {
  return data.testResults.flatMap((suite) => (suite.status === "failed" && suite.assertionResults.length === 0
    ? [`${rel(cwd, suite.name)}|SUITE FAILED TO RUN`]
    : suite.assertionResults.filter((a) => a.status === "failed").map((a) => jestTestTitle(cwd, suite, a))));
}
export function skippedJestTests(data, cwd) {
  const skippedStatuses = new Set(["pending", "todo", "disabled"]);
  return data.testResults.flatMap((suite) => suite.assertionResults
    .filter((a) => skippedStatuses.has(a.status)).map((a) => jestTestTitle(cwd, suite, a)));
}
export function jestResult(data, cwd) {
  const total = data.numPassedTests + data.numFailedTests + data.numPendingTests + (data.numTodoTests ?? 0);
  const counts = { suites_passed: data.numPassedTestSuites, suites_failed: data.numFailedTestSuites,
    tests_passed: data.numPassedTests, tests_failed: data.numFailedTests,
    tests_skipped: data.numPendingTests, tests_total: total };
  const failing = failingJestTests(data, cwd);
  const skipped = skippedJestTests(data, cwd);
  const members = { failing_tests: failing, skipped_tests: skipped };
  if (skipped.length !== data.numPendingTests + (data.numTodoTests ?? 0)) {
    return broken("jest-json", "pending test count does not match skipped title count", counts, members);
  }
  if (total === 0) return broken("jest-json", "0 total tests", counts, members);
  const ok = data.numFailedTests === 0 && data.numFailedTestSuites === 0;
  return result("jest-json", ok, counts, members);
}

function parseExitCode(name, run) {
  if (spawnReason(run)) return broken(name, spawnReason(run));
  return result(name, run.status === 0, { exit: run.status }, { failures: run.status ? [name] : [] });
}
function parseJestJson(name, run, cwd, outputFile) {
  if (spawnReason(run)) return broken(name, spawnReason(run));
  let data;
  try { data = JSON.parse(readFileSync(outputFile, "utf8")); } catch (error) {
    return broken(name, `missing/invalid result JSON: ${error.message}`);
  }
  return { ...jestResult(data, cwd), name };
}
function parseEslintJson(name, run, cwd) {
  if (spawnReason(run)) return broken(name, spawnReason(run));
  let files;
  try { files = JSON.parse(run.output); } catch (error) { return broken(name, `invalid JSON: ${error.message}`); }
  if (!files.length) return broken(name, "0 files linted", { files: 0 }, { errors: [], warnings: [] });
  const errors = [], warnings = [];
  for (const file of files) for (const message of file.messages) {
    const key = `${rel(cwd, file.filePath)}|${message.ruleId ?? "null"}|${message.message}`;
    (message.severity === 2 ? errors : warnings).push(key);
  }
  const counts = { files: files.length, errors: errors.length, warnings: warnings.length, exit: run.status };
  return result(name, errors.length === 0, counts, { errors, warnings });
}
function parseTsc(name, run) {
  if (spawnReason(run)) return broken(name, spawnReason(run));
  const errors = run.output.split("\n").filter((line) => /error TS\d+:/.test(line));
  const members = errors.map((line) => {
    const match = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
    return match ? `${match[1]}|${match[2]}|${match[3]}` : line.trim();
  });
  return result(name, run.status === 0, { errors: errors.length, exit: run.status }, { errors: members });
}

// gate: { name, cmd, cwd, parser, args? }. cwd is resolved against repoRoot by the caller.
export function runGate(gate, repoRoot) {
  const { name, cmd, cwd = ".", parser } = gate;
  if (!PARSER_NAMES.includes(parser)) {
    throw new Error(`unknown parser "${parser}" for gate "${name}" — supported: ${PARSER_NAMES.join(", ")}`);
  }
  const resolvedCwd = join(repoRoot, cwd);
  if (parser === "jest-json") {
    const outputFile = join(tmpdir(), `10xs-gate-${name}-${process.pid}-${Date.now()}-${Math.random()}.json`);
    const run = shell(`${cmd} --json --outputFile=${outputFile}`, resolvedCwd);
    return parseJestJson(name, run, resolvedCwd, outputFile);
  }
  if (parser === "eslint-json") return parseEslintJson(name, shell(`${cmd} -f json`, resolvedCwd), resolvedCwd);
  if (parser === "tsc") return parseTsc(name, shell(cmd, resolvedCwd));
  return parseExitCode(name, shell(cmd, resolvedCwd));
}

export function runGates(repoRoot, gatesConfig, names) {
  return names.map((name) => {
    const gate = gatesConfig[name];
    if (!gate) throw new Error(`no gate named "${name}" in config.gates`);
    return runGate({ ...gate, name }, repoRoot);
  });
}
