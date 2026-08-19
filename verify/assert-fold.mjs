#!/usr/bin/env node
// Adapted from the monorepo's scripts/governance/assert-fold.mjs. Defaults there were a literal
// object hardcoding monorepo-specific paths and an ['origin/dev', 'origin/main'] base-ref
// fallback; here every default comes from verify/config.mjs (10xs-kernel.json, or its built-in
// defaults), resolved once in main() and passed down — never re-read from disk in a leaf module.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateAgainstSchema } from './schema-check.mjs';
import { assertAppendUnion } from './append-union.mjs';
import { reportAuthorshipFindings } from './report-authorship.mjs';
import { evidenceAtFoldFindings } from './evidence-at-fold.mjs';
import { loadConfig, resolveBaseRef } from './config.mjs';

function parseArgs(argv, cfg) {
  const args = {
    eventsDir: cfg.eventsDir, schema: cfg.eventSchema, probeRegistryDir: cfg.probeRegistryDir,
    frozenRegistry: cfg.frozenProbeRegistry, appendFiles: [], reportsPrefix: cfg.reportPrefixes[0],
  };
  const names = { '--merged': 'merged', '--ours': 'ours', '--theirs': 'theirs', '--events-dir': 'eventsDir',
    '--schema': 'schema', '--probe-registry-dir': 'probeRegistryDir', '--frozen-registry': 'frozenRegistry',
    '--report-base': 'reportBase', '--reports-prefix': 'reportsPrefix' };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--append-file') args.appendFiles.push(argv[++i]);
    else if (flag === '--only') args.only = argv[++i].split(',');
    else if (names[flag]) args[names[flag]] = argv[++i];
    else { console.error(`Unknown or incomplete option: ${flag}`); process.exit(2); }
  }
  if (!args.merged) { console.error('Usage: assert-fold.mjs --merged <ref|worktree path> [options]'); process.exit(2); }
  if (!args.appendFiles.length) args.appendFiles = cfg.appendFiles;
  return args;
}

const enabledOf = (args) => (letter) => !args.only || args.only.includes(letter);
const isTree = (source) => existsSync(source) && statSync(source).isDirectory();
const read = (source, path) => isTree(source) ? readFileSync(join(source, path), 'utf8') : execFileSync('git', ['show', `${source}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const maybeRead = (source, path) => { try { return read(source, path); } catch { console.log(`  MISSING ${path} at ${source}; treating as empty`); return ''; } };
const files = (source, dir) => {
  if (!isTree(source)) { try { return execFileSync('git', ['ls-tree', '-r', '--name-only', source, '--', dir], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch { return []; } }
  const root = join(source, dir); if (!existsSync(root)) return [];
  const walk = (where) => readdirSync(where).flatMap((name) => statSync(join(where, name)).isDirectory() ? walk(join(where, name)) : [relative(source, join(where, name))]);
  return walk(root);
};

function resolveFoldAndBase(args, enabled, repo) {
  if (!enabled('e') && !enabled('f')) return {};
  const merged = isTree(args.merged);
  const gitDir = merged ? args.merged : repo;
  const rev = merged ? 'HEAD' : `${args.merged}^{commit}`;
  let foldSha;
  try { foldSha = execFileSync('git', ['-C', gitDir, 'rev-parse', rev], { encoding: 'utf8' }).trim(); } catch { /* reported below */ }
  let baseSha = args.reportBase || null;
  if (!baseSha && foldSha) {
    try {
      const ref = resolveBaseRef(gitDir, null);
      baseSha = execFileSync('git', ['-C', gitDir, 'merge-base', foldSha, ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { baseSha = null; }
  }
  return { gitDir, foldSha, baseSha };
}

function runAssertions(args, cfg) {
  const results = [];
  const finish = (letter, errors, notes = []) => { notes.forEach((x) => console.log(x)); errors.forEach((x) => console.error(x)); const ok = !errors.length; console.log(`[${letter}] ${ok ? 'PASS' : 'FAIL'}`); results.push(ok); };
  const enabled = enabledOf(args);
  let schema;
  // The bundled default (config.eventSchema) is an absolute path to a file shipped inside this
  // npm package, never part of the target repo's own git tree — git show can't see it, so an
  // absolute path that exists on disk is read directly. A relative path (a repo that configured
  // its own committed schema copy) is looked up at the merged ref instead, same as every other
  // path this tool resolves.
  const loadSchema = () => { if (schema) return schema; try { schema = JSON.parse(isAbsolute(args.schema) && existsSync(args.schema) ? readFileSync(args.schema, 'utf8') : read(args.merged, args.schema)); return schema; } catch (error) { throw new Error(`schema unavailable or invalid at ${args.schema} in ${args.merged}: ${error.message}`); } };
  const eventFilesOf = () => files(args.merged, args.eventsDir).filter((f) => f.endsWith('.json') && !f.startsWith(`${args.eventsDir}/schema/`));
  const { gitDir, foldSha, baseSha } = resolveFoldAndBase(args, enabled, process.cwd());
  const eventEntries = (enabled('e') || enabled('f'))
    ? eventFilesOf().map((path) => { try { return { path, event: JSON.parse(read(args.merged, path)) }; } catch { return null; } }).filter(Boolean)
    : [];

  if (enabled('a')) {
    const errors = [];
    try { const contract = loadSchema(); for (const file of eventFilesOf()) { try { const obj = JSON.parse(read(args.merged, file)); const check = validateAgainstSchema(obj, contract); for (const e of check.errors) errors.push(`[a] ${file} ${e.pointer || '/'}: ${e.message}`); } catch (error) { errors.push(`[a] ${file} /: invalid JSON or schema: ${error.message}`); } } } catch (error) { errors.push(`[a] ${error.message}; add the event schema before running assertion (a)`); }
    finish('a', errors);
  }
  if (enabled('b')) {
    const errors = []; const eventFiles = eventFilesOf();
    const seen = new Set(); let kinds;
    try { kinds = loadSchema().properties?.kind?.enum || []; } catch (error) { errors.push(`[b] ${error.message}; add the event schema before running assertion (b)`); }
    for (const file of eventFiles) { if (seen.has(file)) errors.push(`[b] duplicate merged event path: ${file}`); seen.add(file); const name = file.split('/').at(-1); const match = name.match(/^(.+)__(.+)__(.+)\.json$/); let obj; try { obj = JSON.parse(read(args.merged, file)); } catch { continue; } if (!match) errors.push(`[b] ${file}: filename must be <timestamp>__<mt_id-or-scope>__<kind>.json`); else { const kind = match[3], timestamp = typeof obj.ts === 'string' ? obj.ts.replaceAll(':', '-') : ''; if (match[1] !== timestamp) errors.push(`[b] ${file} /ts: filename timestamp ${JSON.stringify(match[1])}, expected ${JSON.stringify(timestamp)}`); if (kinds && !kinds.includes(kind)) errors.push(`[b] ${file}: filename kind ${JSON.stringify(kind)} is not in schema enum`); if (obj.kind !== kind) errors.push(`[b] ${file} /kind: filename says ${JSON.stringify(kind)}, file says ${JSON.stringify(obj.kind)}`); } }
    if (args.ours && args.theirs && !isTree(args.ours) && !isTree(args.theirs)) { try { const base = execFileSync('git', ['merge-base', args.ours, args.theirs], { encoding: 'utf8' }).trim(); const added = (ref) => new Set(execFileSync('git', ['diff', '--name-only', '--diff-filter=A', base, ref, '--', args.eventsDir], { encoding: 'utf8' }).trim().split('\n').filter((x) => x.endsWith('.json') && !x.includes('/schema/'))); for (const path of added(args.ours)) if (added(args.theirs).has(path)) errors.push(`[b] duplicate source-branch event path: ${path}`); } catch (error) { errors.push(`[b] could not compare source branch event paths: ${error.message}`); } }
    finish('b', errors);
  }
  if (enabled('c')) {
    if (!args.ours || !args.theirs) console.log('[c] SKIP: --ours and --theirs are required');
    else { const errors = [], notes = []; for (const path of args.appendFiles) { const check = assertAppendUnion(path, maybeRead(args.ours, path), maybeRead(args.theirs, path), maybeRead(args.merged, path)); check.lost.forEach((line) => errors.push(`[c] ${path} LOST: ${JSON.stringify(line)}`)); check.invented.forEach((line) => errors.push(`[c] ${path} INVENTED: ${JSON.stringify(line)}`)); check.duplicates.forEach(({ line, count }) => notes.push(`[c] ${path} DUPLICATE (non-fatal, ${count} copies): ${JSON.stringify(line)}`)); } finish('c', errors, notes); }
  }
  if (enabled('d')) {
    const errors = [], notes = []; const probeFiles = files(args.merged, args.probeRegistryDir).filter((f) => f.endsWith('.json'));
    if (!probeFiles.length) console.log(`[d] SKIP: probe registry directory absent or contains no JSON files at ${args.probeRegistryDir}`);
    else { const ids = new Map(); for (const file of probeFiles) { try { const obj = JSON.parse(read(args.merged, file)); if (typeof obj.id !== 'string' || !obj.id.trim()) errors.push(`[d] ${file} /id: expected a non-empty string`); else if (ids.has(obj.id)) errors.push(`[d] ${file} /id: duplicate ${JSON.stringify(obj.id)} also in ${ids.get(obj.id)}`); else ids.set(obj.id, file); } catch (error) { errors.push(`[d] ${file} /: invalid JSON: ${error.message}`); } } try { const frozen = JSON.parse(read(args.merged, args.frozenRegistry)); for (const probe of frozen.probes || []) if (!ids.has(probe.id)) errors.push(`[d] ${args.frozenRegistry} /probes: LOST probe id ${JSON.stringify(probe.id)}`); } catch (error) { errors.push(`[d] ${args.frozenRegistry} /: invalid or missing frozen registry: ${error.message}`); } finish('d', errors, notes); }
  }
  if (enabled('e')) {
    const errors = [];
    const events = eventEntries.map(({ event }) => event);
    if (!foldSha) errors.push('[e] could not resolve --merged to a commit sha');
    if (foldSha) {
      for (const f of reportAuthorshipFindings(gitDir, foldSha, events, baseSha, args.reportsPrefix)) {
        errors.push(`[e] ${f.report_path} (mt_id=${f.mt_id ?? 'unknown'}): ${f.reason}` + ` (pushed_sha=${f.pushed_sha ?? 'n/a'}, fold_sha=${f.fold_sha})`);
      }
    }
    finish('e', errors);
  }
  if (enabled('f')) {
    const errors = [], notes = [];
    if (!foldSha) errors.push('[f] could not resolve --merged to a commit sha');
    else {
      const result = evidenceAtFoldFindings(gitDir, foldSha, eventEntries, baseSha, cfg.evidencePrefix, cfg.instructionsPrefix, args.eventsDir);
      notes.push(...result.notes);
      for (const f of result.findings) errors.push(`[f] ${f.mt_id} (${f.instruction_path}): ${f.reason}` + ` (pushed_sha=${f.pushed_sha ?? 'n/a'}, criterion=${JSON.stringify(f.criterion)})`);
    }
    finish('f', errors, notes);
  }
  return results;
}

function main() {
  const cfg = loadConfig(resolve(process.cwd()));
  const args = parseArgs(process.argv, cfg);
  const results = runAssertions(args, cfg);
  console.log(`Summary: ${results.length} assertions ran, ${results.filter(Boolean).length} passed, ${results.filter((x) => !x).length} failed`);
  process.exitCode = results.some((x) => !x) ? 1 : 0;
}

main();
