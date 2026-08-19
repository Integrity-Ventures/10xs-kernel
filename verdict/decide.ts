/**
 * Extracted from `terraform/modules/project-api/lambda/checker-decide.ts` in
 * the 10xs monorepo (MT 20260819_02 / MT-1b). The checker's decision — pure,
 * synchronous, no db, no clock, no I/O of any kind. Given a card's handover
 * (if any) and its metadata, decide `pass`, `send_back`, or `leave` (nothing
 * here for the checker to judge).
 *
 * Rejected alternative: re-deriving "does this card have a signed CI pass"
 * locally instead of importing `isSignedCiPass` from `grade.ts` — rejected
 * because that predicate is security-shaped (it is the difference between
 * "the checker actually re-ran something" and "the checker is trusting a
 * claim"), and a second copy of a security-shaped predicate is itself the
 * defect, not a convenience.
 *
 * PRECEDENCE (architect ruling, S414 fold — overrides the lane's original
 * interpretation call): row 4 ("no handover at all" -> leave) is evaluated
 * FIRST, ahead of row 1, even though it is numbered last below. The rows
 * keep their original numbers because the monorepo's tests and the rest of
 * that codebase already refer to them by number; only the EVALUATION ORDER
 * changed.
 *
 * Why: the monorepo's handover fetch deliberately degrades to
 * `handover: null` when the handover query itself throws, so that a DB
 * failure never turns the queue into a 500. Under the original
 * (row-1-first) order, a degraded read plus any stale `your_ci` check
 * already sitting on the card would still auto-write a `pass` — the checker
 * would fail OPEN on exactly the read failure it was supposed to guard
 * against, marking work "done" that it provably never looked at. And since
 * the grade is bound to the sha carried on the handover, a null handover has
 * no sha to grade, so `deriveGrade` would call the result "evidence only"
 * while the verdict it just wrote claimed a real CI pass — the receipt
 * would contradict itself. A component whose only power is writing `done`
 * must fail CLOSED when it cannot see the work, so `leave` wins over every
 * other row whenever there is no handover to read.
 *
 *   1. metadata.checks has a your_ci/pass entry  -> verdict/pass  (R8 (b))
 *   2. no such check, handover.evidence non-empty -> verdict/pass  (R8 (d))
 *   3. handover present, evidence empty/whitespace -> verdict/send_back
 *   4. no handover at all                          -> leave (EVALUATED FIRST)
 */
import { isSignedCiPass } from "./grade";

/**
 * Minimal structural echo of the monorepo's `Handover` type
 * (`board-validator-handover-sql.ts`) — only the fields `decide` touches.
 * The real type also carries `status`, `artifactUrl`, `reportedAt`, and
 * `reportId`; this package does not need them and does not import the real
 * type across the repo boundary.
 */
export interface HandoverLike {
  evidence?: string | null;
  sha?: string | null;
}

export type CheckerDecision =
  | { act: "verdict"; verdict: "pass" | "send_back"; reason: string | null }
  | { act: "leave"; why: string };

const SEND_BACK_REASON =
  "Handed over with no evidence. Say what you changed, how you checked it, and where the output is.";

/** metadata.checks holding a signed `your_ci` pass — imported predicate
 *  (grade.ts's `isSignedCiPass`), just the array-membership wrapper around
 *  it that `deriveGrade` itself also uses. */
function hasSignedCiPass(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const checks = (metadata as Record<string, unknown>).checks;
  return Array.isArray(checks) && checks.some(isSignedCiPass);
}

export function decide(input: { handover: HandoverLike | null; metadata: unknown }): CheckerDecision {
  const { handover, metadata } = input;

  // Architect ruling, S414 fold: the `leave` guard comes FIRST. A card with no
  // handover is not the checker's to judge, even when a signed `your_ci` check
  // sits on it — the checker would otherwise write `done` on work it never
  // read, and (after the sha-binding fix) the receipt would grade it
  // "evidence only" while the pass claimed CI verification. No handover, no
  // verdict. This is the ordering that prevents the fail-OPEN bug described
  // in the file docblock above (a degraded null-handover read otherwise still
  // auto-wrote a `pass`).
  if (!handover) return { act: "leave", why: "no handover — the checker has nothing to read" };

  if (hasSignedCiPass(metadata)) {
    return { act: "verdict", verdict: "pass", reason: null };
  }
  // `evidence` is optional on this package's structural type (the real
  // `Handover` always carries the key, just possibly `null`); a `typeof`
  // guard reads `undefined` the same honest way it reads `null` — no
  // evidence, not a pass — without assuming the key exists.
  if (typeof handover.evidence === "string" && handover.evidence.trim().length > 0) {
    return { act: "verdict", verdict: "pass", reason: null };
  }
  return { act: "verdict", verdict: "send_back", reason: SEND_BACK_REASON };
}
