import { PASS_CLAIM_PHRASES, TEST_CLAIM_PHRASES } from './report-facts.mjs';

export const HELP = `Usage: report-gate.mjs --report <path> --facts <path> [--repo <path>] [--allow-stale]

Findings RG001-RG008, every one printed (not just the first). Exit 1 if any fires, exit 0 only
when clean, exit 2 on a usage error (missing/bad args, unreadable --report/--facts, invalid JSON).

RG001 unexpanded-substitution - a literal "$(" or "\${" in a report-facts.json string value, or
  anywhere in the report text OUTSIDE a fenced \`\`\` code block, is the ca1 fabrication signature
  (the literal, unexpanded "$(git rev-parse HEAD)"). Inside a fenced block it is legitimate - a
  pasted command may genuinely contain it.
RG002 unresolvable-sha / RG003 sha-mismatch / RG004 line-count-mismatch - a sha, a labeled
  "- head/base sha: <hex>" line, or a "path status=S lines=N max=M" claim in the report's factual
  section that disagrees with a fresh git re-measurement in --repo (RG004 re-measures at the
  CURRENT HEAD, never trusting facts.head_sha - a fabricated facts file must not validate a
  fabricated report). RG004 visibly skips only a claim for the report under gate because a report
  cannot stably measure itself; all other claims remain enforced. RG003 allows an older reported
  head only when it is an ancestor of
  facts.head_sha and the non-empty advance touches report/event paths only.
RG005 test-claim-without-output - the report text contains, case-insensitively, one of:
  ${TEST_CLAIM_PHRASES.map((p) => `"${p}"`).join(', ')}
  while facts.test is null, or its output_path is missing/unreadable, or its sha256 mismatches.
RG006 pass-claimed-nonzero-exit - one of: ${PASS_CLAIM_PHRASES.map((p) => `"${p}"`).join(', ')}
  while facts.test is non-null and facts.test.exit_code !== 0.
RG007 stale-facts - facts.head_sha differs from a fresh "git rev-parse HEAD" in --repo. An
  ancestor facts head is allowed when the non-empty advance touches report/event paths only.
  Otherwise --allow-stale suppresses the finding and prints a visible suppression line.
RG008 evidence-empty-report - the executor narrative heading must exist, with at least five
  non-blank prose lines beyond the skeleton boilerplate and a fenced block containing non-blank
  pasted output. This measures only the presence of evidence, never its quality or truthfulness;
  deciding whether evidence proves a claim remains the validating architect's responsibility.
`;
