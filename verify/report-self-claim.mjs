import { isAbsolute, relative, resolve } from 'node:path';
import {
  extractChangedFileClaims,
  gitRevParse,
  measureFileAtRef,
} from './report-facts.mjs';

export function selfClaimPath(repo, reportPath) {
  const path = relative(resolve(repo), resolve(reportPath));
  if (path === '' || path.startsWith('..') || isAbsolute(path)) return null;
  return path;
}

export function checkRG004(factual, repo, reportPath) {
  const freshHead = gitRevParse(repo, 'HEAD');
  const selfPath = selfClaimPath(repo, reportPath);
  const out = [];
  for (const claim of extractChangedFileClaims(factual)) {
    if (claim.path === selfPath) {
      console.error(
        `[RG004 SKIPPED self-claim] ${claim.path}: a report cannot be a stable measurement of itself`,
      );
      continue;
    }
    const measured = measureFileAtRef(repo, freshHead, claim.path);
    const actualLines = measured ? measured.lines : null;
    const actualMax = measured ? measured.longest_line : null;
    if (actualLines === claim.lines && actualMax === claim.longest_line) continue;
    const msg = `${claim.line.trim()} - fresh HEAD (${freshHead}) measures lines=${actualLines} max=${actualMax}`;
    out.push({ code: 'RG004', file: reportPath, line: claim.lineNo, message: msg });
  }
  return out;
}
