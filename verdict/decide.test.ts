import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "./decide";

test("decide: a signed your_ci pass in metadata.checks -> verdict/pass", () => {
  const result = decide({
    handover: { evidence: "did the thing" },
    metadata: { checks: [{ source: "your_ci", result: "pass" }] },
  });
  assert.deepEqual(result, { act: "verdict", verdict: "pass", reason: null });
});

test("decide: non-empty handover.evidence, no signed check -> verdict/pass", () => {
  const result = decide({
    handover: { evidence: "did the thing, here is the link" },
    metadata: null,
  });
  assert.deepEqual(result, { act: "verdict", verdict: "pass", reason: null });
});

// Disagreeing fixture (1 of 4): whitespace-only evidence is NOT evidence.
test("disagreeing fixture: whitespace-only evidence -> send_back, not pass", () => {
  const result = decide({ handover: { evidence: "   " }, metadata: null });
  assert.equal(result.act, "verdict");
  assert.equal((result as { verdict: string }).verdict, "send_back");
});

// Disagreeing fixture (2 of 4): a your_ci check that FAILED must not read as
// a pass basis, even with a handover present but empty.
test("disagreeing fixture: your_ci result=fail is not a pass basis", () => {
  const result = decide({
    handover: { evidence: "" },
    metadata: { checks: [{ source: "your_ci", result: "fail" }] },
  });
  assert.deepEqual(result, {
    act: "verdict",
    verdict: "send_back",
    reason:
      "Handed over with no evidence. Say what you changed, how you checked it, and where the output is.",
  });
});

// Disagreeing fixture (3 of 4): no handover at all -> leave, evaluated FIRST.
//
// This is the S414 fold precedence ruling from the file docblock: without
// this guard running before the "signed your_ci pass" row, a handover fetch
// that degrades to `null` on a DB error — combined with a stale signed check
// still sitting on the card from an earlier pass — would auto-write `pass`
// on work the checker never actually read. That is the fail-OPEN bug this
// ordering exists to prevent: a null handover must fail CLOSED (`leave`),
// never fall through to a stale metadata check.
test("disagreeing fixture: no handover at all -> leave (guards the fail-open bug)", () => {
  const result = decide({
    handover: null,
    metadata: { checks: [{ source: "your_ci", result: "pass" }] },
  });
  assert.deepEqual(result, { act: "leave", why: "no handover — the checker has nothing to read" });
});
