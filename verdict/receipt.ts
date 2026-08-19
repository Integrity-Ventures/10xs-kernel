/**
 * Extracted from `terraform/modules/project-api/lambda/validation-receipt.ts`
 * in the 10xs monorepo (MT 20260819_02 / MT-1b). Defensive reader for a
 * card's validation receipt. Absent, partial, or malformed receipts are the
 * NORMAL case for every card that exists today — this must read as
 * "not validated", never throw, and never drop the card.
 *
 * Real receipt shape, as written by the monorepo's `buildReceipt`:
 * `{ verdict, by, at, evidenceUrl, reason, needsHuman, grade }` — `verdict` a
 * non-empty string, `by` the validating agent id, `at` an ISO timestamp,
 * `evidenceUrl`/`reason` optional strings, `needsHuman` a boolean, `grade`
 * one of the four `ValidationGrade` values derived by `deriveGrade`
 * (`grade.ts`). This reader's OUTPUT interface keeps `who`/`when`/`needsYou`
 * — only the INPUT keys are the writer's real names. `by`/`at`/`needsHuman`
 * are read first; `who`/`when`/`needsYou` are kept as a tolerated alias in
 * case a future or hand-authored receipt uses them.
 *
 * `grade`: an OLD receipt — every card validated before grading existed —
 * has no `grade` key at all. That is the normal case, not a malformed one,
 * and it reads as `evidence only` here, never `undefined`, never a crash,
 * same posture as every other defensive read in this file.
 */
import type { ValidationGrade } from "./grade";

export interface ValidationReceipt {
  status: "validated" | "not_validated";
  verdict?: string;
  who?: string;
  when?: string;
  evidenceUrl?: string;
  reason?: string;
  needsYou: boolean;
  grade: ValidationGrade;
}

// Verdict literals must match the real writer's union: `Verdict` is
// `"pass" | "send_back"` — NOT "sent_back". "warn", "fail", "unvalidatable"
// are not (yet) real Verdict values either but are kept here as
// forward-compatible safety members.
export const NEEDS_YOU_VERDICTS = new Set(["warn", "fail", "unvalidatable", "send_back"]);
export const KNOWN_GRADES = new Set<ValidationGrade>([
  "re-run by 10xs", "re-run by your CI", "re-run on your machine", "evidence only",
]);

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Anything other than one of the four known strings — absent, wrong type,
 * a typo — falls through to `evidence only` (never guess). */
function grade(value: unknown): ValidationGrade {
  return typeof value === "string" && KNOWN_GRADES.has(value as ValidationGrade)
    ? (value as ValidationGrade)
    : "evidence only";
}

const NOT_VALIDATED: ValidationReceipt = {
  status: "not_validated",
  needsYou: false,
  grade: "evidence only",
};

/**
 * Read `metadata.validation` (raw JSONB, `unknown`) defensively. Anything
 * other than a well-formed object carrying a non-empty `verdict` string
 * resolves to `NOT_VALIDATED` — the honest default whether the receipt
 * writer hasn't run yet, or wrote something malformed.
 */
export function readValidationReceipt(metadata: unknown): ValidationReceipt {
  if (!metadata || typeof metadata !== "object") return NOT_VALIDATED;
  const raw = (metadata as Record<string, unknown>).validation;
  if (!raw || typeof raw !== "object") return NOT_VALIDATED;
  const r = raw as Record<string, unknown>;
  const verdict = str(r.verdict);
  if (!verdict) return NOT_VALIDATED;
  // `by`/`at`/`needsHuman` are the real writer's keys (buildReceipt); `who`/
  // `when`/`needsYou` are a tolerated alias for anything else that writes
  // this leaf using the names this reader originally assumed.
  const explicitNeedsYou =
    typeof r.needsHuman === "boolean"
      ? r.needsHuman
      : typeof r.needsYou === "boolean"
        ? r.needsYou
        : undefined;
  return {
    status: "validated",
    verdict,
    who: str(r.by) ?? str(r.who),
    when: str(r.at) ?? str(r.when),
    evidenceUrl: str(r.evidenceUrl),
    reason: str(r.reason),
    needsYou: explicitNeedsYou ?? NEEDS_YOU_VERDICTS.has(verdict),
    grade: grade(r.grade),
  };
}
