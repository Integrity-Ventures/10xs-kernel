/**
 * Extracted from `terraform/modules/project-api/lambda/verdict-grade.ts` in
 * the 10xs monorepo (MT 20260819_02 / MT-1b). The receipt's `grade` — HOW a
 * verdict was actually checked, not just what it says. Four grades exist
 * (the R8 ruling addendum); this round only ever emits two of them:
 *
 *   - "re-run by your CI" — a signed check from the customer's CI landed on
 *     the card before this verdict (a producer whose shape is:
 *     `{ source, sha, runUrl, result, at }`, a cross-lane contract — the
 *     field names below are NOT renamed even though that producer may not
 *     have landed in every consumer yet).
 *   - "evidence only" — everything else: no producer exists yet for
 *     `re-run by 10xs` or `re-run on your machine` (stated gap, not a bug),
 *     and anywhere this derivation can't POSITIVELY confirm a signed CI
 *     pass. A grade that overclaims is worse than no grade, so every
 *     ambiguous, malformed, or absent shape falls through to here rather
 *     than guessing.
 *
 * F79: `deriveGrade` used to ask "does this CARD carry any passing your_ci
 * check?" — never "for WHICH commit?". A customer's CI posting an honest
 * pass for commit A, followed by a machine handing over unrelated commit B
 * on the SAME card, produced a receipt claiming B was independently re-run.
 * `expectedSha` closes that: `"re-run by your CI"` now requires a signed
 * pass whose OWN `sha` STRING-equals `expectedSha` — no case-folding, no
 * abbreviated-prefix matching (both are policy calls a lane does not get to
 * make). An absent/null/empty/whitespace-only `expectedSha` is NOT a "match
 * anything" wildcard — it is the F79 defect itself, so it grades
 * `"evidence only"`, deliberately, even when the card's checks would have
 * matched under the old card-level rule. `isSignedCiPass` alone can never
 * again earn `"re-run by your CI"` — it only gates ELIGIBILITY to be
 * checked against a sha.
 *
 * NOT carried across: `readPreVerdictGrade` (the monorepo's async, db-backed
 * wrapper around `loadActiveTaskBySourceRef`). It is the only impure part of
 * the original file — this package promises zero runtime dependencies and no
 * I/O, so the caller is responsible for fetching whatever `deriveGrade`
 * needs and passing it in.
 */

export type ValidationGrade =
  | "re-run by 10xs"
  | "re-run by your CI"
  | "re-run on your machine"
  | "evidence only";

/** A signed `your_ci` pass — a security-shaped predicate. `checker-decide.ts`
 *  (this package's `decide.ts`) imports this exact function rather than
 *  re-implementing it: a second copy of a security-shaped predicate is
 *  itself the defect, not a convenience. */
export function isSignedCiPass(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return e.source === "your_ci" && e.result === "pass";
}

/** `expectedSha` is "present" only when it is a non-empty, non-whitespace
 *  string — `undefined`/`null`/`""`/`"   "` all normalise to "absent" (F79:
 *  absent must NOT fall back to card-level matching, the defect itself). */
function isPresentSha(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** A signed `your_ci` pass whose OWN `sha` field STRICT-equals `expectedSha`
 *  (`===`; a non-string or missing `entry.sha` can never equal a string, so
 *  no extra type check is needed). */
function matchesExpectedSha(entry: unknown, expectedSha: string): boolean {
  if (!isSignedCiPass(entry)) return false;
  return (entry as Record<string, unknown>).sha === expectedSha;
}

/**
 * Pure + synchronous. `metadata.checks` must be an array containing at
 * least one entry with `source === "your_ci"` AND `result === "pass"` AND a
 * `sha` that STRICT-equals `expectedSha` to earn `re-run by your CI`.
 * Absent key, non-array, empty array, no matching entry, or an absent
 * `expectedSha` all fall through to `evidence only` (see file docblock for
 * the "never guess" rule and why "no sha given" is NOT a wildcard).
 */
export function deriveGrade(
  metadata: unknown,
  expectedSha?: string | null,
): ValidationGrade {
  if (!metadata || typeof metadata !== "object") return "evidence only";
  const checks = (metadata as Record<string, unknown>).checks;
  if (!Array.isArray(checks)) return "evidence only";
  if (!isPresentSha(expectedSha)) return "evidence only";
  return checks.some((entry) => matchesExpectedSha(entry, expectedSha))
    ? "re-run by your CI"
    : "evidence only";
}
