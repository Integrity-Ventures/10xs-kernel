import { test } from "node:test";
import assert from "node:assert/strict";
import { readValidationReceipt, NEEDS_YOU_VERDICTS, KNOWN_GRADES } from "./receipt";

test("readValidationReceipt: absent/malformed metadata reads as not_validated", () => {
  assert.equal(readValidationReceipt(null).status, "not_validated");
  assert.equal(readValidationReceipt({}).status, "not_validated");
  assert.equal(readValidationReceipt({ validation: "not-an-object" }).status, "not_validated");
});

test("readValidationReceipt: a real send_back receipt reads needsYou=true", () => {
  const receipt = readValidationReceipt({ validation: { verdict: "send_back" } });
  assert.equal(receipt.status, "validated");
  assert.equal(receipt.needsYou, true);
});

test("readValidationReceipt: unknown grade string falls through to 'evidence only'", () => {
  const receipt = readValidationReceipt({
    validation: { verdict: "pass", grade: "not a real grade" },
  });
  assert.equal(receipt.grade, "evidence only");
});

// Disagreeing fixture (4 of 4, required by MT 20260819_02): the F83 typo.
// `NEEDS_YOU_VERDICTS` is spelled `"send_back"` (the real writer's union);
// `"sent_back"` — an easy typo, the exact one F83 was — is NOT a member.
//
// What was actually run and observed: a receipt whose `verdict` is the
// typo'd `"sent_back"` does NOT crash and does NOT get treated as
// `not_validated` (the string is non-empty, so it still parses as a
// "validated" receipt) — but `needsYou` silently reads `false`, because
// `"sent_back"` fails the `NEEDS_YOU_VERDICTS.has(verdict)` membership check
// and no explicit `needsHuman`/`needsYou` boolean was supplied to override
// it. In other words: this reader does NOT "silently read as needs-you" —
// it does the opposite. It silently reads as needs-you = false, which is the
// more dangerous failure mode (a card that was sent back for rework reads as
// if nothing is wrong with it). This is exactly the shape of bug F83 was:
// a one-character typo between "send_back" and "sent_back" that a defensive
// reader will never surface on its own, because both are plausible-looking
// strings and this function does not know which one the writer meant.
test("disagreeing fixture: the F83 typo 'sent_back' does not read as needs-you", () => {
  const receipt = readValidationReceipt({ validation: { verdict: "sent_back" } });
  assert.equal(receipt.status, "validated");
  assert.equal(receipt.verdict, "sent_back");
  assert.equal(
    receipt.needsYou,
    false,
    "F83: 'sent_back' (typo) is absent from NEEDS_YOU_VERDICTS, so it silently reads as needsYou=false, not true",
  );
  assert.equal(NEEDS_YOU_VERDICTS.has("sent_back"), false);
  assert.equal(NEEDS_YOU_VERDICTS.has("send_back"), true);
});

test("KNOWN_GRADES: exactly the four ValidationGrade literals", () => {
  assert.equal(KNOWN_GRADES.size, 4);
  assert.equal(KNOWN_GRADES.has("re-run by 10xs"), true);
  assert.equal(KNOWN_GRADES.has("re-run by your CI"), true);
  assert.equal(KNOWN_GRADES.has("re-run on your machine"), true);
  assert.equal(KNOWN_GRADES.has("evidence only"), true);
});
