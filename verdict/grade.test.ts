import { test } from "node:test";
import assert from "node:assert/strict";
import { isSignedCiPass, deriveGrade } from "./grade";

test("isSignedCiPass: requires source=your_ci AND result=pass", () => {
  assert.equal(isSignedCiPass({ source: "your_ci", result: "pass" }), true);
  assert.equal(isSignedCiPass({ source: "your_ci", result: "fail" }), false);
  assert.equal(isSignedCiPass(null), false);
  assert.equal(isSignedCiPass("not-an-object"), false);
});

test("deriveGrade: matching sha on a signed pass earns 're-run by your CI'", () => {
  const metadata = { checks: [{ source: "your_ci", result: "pass", sha: "abc123" }] };
  assert.equal(deriveGrade(metadata, "abc123"), "re-run by your CI");
});

test("deriveGrade: mismatched sha falls through to 'evidence only' (F79)", () => {
  const metadata = { checks: [{ source: "your_ci", result: "pass", sha: "abc123" }] };
  assert.equal(deriveGrade(metadata, "def456"), "evidence only");
});

test("deriveGrade: absent/whitespace expectedSha is NOT a wildcard (F79)", () => {
  const metadata = { checks: [{ source: "your_ci", result: "pass", sha: "abc123" }] };
  assert.equal(deriveGrade(metadata, undefined), "evidence only");
  assert.equal(deriveGrade(metadata, null), "evidence only");
  assert.equal(deriveGrade(metadata, "   "), "evidence only");
});

// Disagreeing fixture (2 of 4, required by MT 20260819_02): a `your_ci`
// entry that FAILED must not earn a pass-shaped grade even when its sha
// matches — `isSignedCiPass` requires result==="pass", so a fail entry never
// reaches the sha comparison at all.
test("disagreeing fixture: a your_ci entry with result=fail never earns 're-run by your CI'", () => {
  const metadata = { checks: [{ source: "your_ci", result: "fail", sha: "abc123" }] };
  assert.equal(deriveGrade(metadata, "abc123"), "evidence only");
});
