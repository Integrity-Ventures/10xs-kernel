# The stranger's fixture

Two completion reports, in the format this tool checks (`## Executor narrative (unverified
claim)` heading, everything above it treated as measured fact), against a small public repo that
is not ours: [jonschlinkert/is-number](https://github.com/jonschlinkert/is-number), commit
`98e8ff1da1a89f93d1397a24d7413ed15421c139` ("7.0.0"), measured against its immediate parent
`cd4a37b3b81262de03445ad0dfc3bfdb7d791017` ("use quotes").

- `reports/honest_report.md` — every claim in it is true. It should pass.
- `reports/fabricated_report.md` — identical except for one line: it claims `test.js` is 150
  lines long. At the stated head sha it is actually 153 lines. It should be caught.

Follow these commands, in order, from a fresh clone of this repository. Nothing here assumes you
have anything else checked out.

```sh
# 1. Clone this repo (the gate) and the fixture target (the repo being reported on).
git clone <this-repo-url> 10xs-kernel
cd 10xs-kernel
git clone https://github.com/jonschlinkert/is-number.git /tmp/is-number-fixture
cd /tmp/is-number-fixture && npm install && cd -

# 2. The honest report should pass (exit 0).
node bin/10xs.mjs check \
  --report fixtures/reports/honest_report.md \
  --base cd4a37b \
  --test-cmd "npm test" \
  --repo /tmp/is-number-fixture

# 3. The fabricated report should be caught (exit 1), naming the file and the mismatch:
#    RG004 ... test.js status=M lines=150 max=82 - fresh HEAD (98e8ff1...) measures lines=153 max=82
node bin/10xs.mjs check \
  --report fixtures/reports/fabricated_report.md \
  --base cd4a37b \
  --test-cmd "npm test" \
  --repo /tmp/is-number-fixture
```

`check` does the harvest fresh every time — it does not trust anything already written down in
either report. That is the whole mechanism: the gate never reads a claim as true, it re-measures
and compares.

If step 2 does not exit 0, or step 3 does not exit 1 naming `test.js`, something about this
extraction is broken — that is the one hour this fixture exists to catch.
