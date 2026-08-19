# Report facts — MT fixture-demo

- repo: /tmp/fixture-check
- branch: master
- head sha: 98e8ff1da1a89f93d1397a24d7413ed15421c139
- base sha: cd4a37b3b81262de03445ad0dfc3bfdb7d791017

## Changed files

- package.json status=M lines=82 max=132
- test.js status=M lines=153 max=82

## Test

- command: npm test
- exit code: 0
- output path: /tmp/fixture-harvest-out/test-output.txt
- output sha256: 45e9be8393041980886eb4d58dc1a92d1e4859de25878ed1a1c0fa45e0d6cc7f
- output bytes: 4075

Everything above this line was measured by harvest.mjs - do not hand-edit it.

## Executor narrative (unverified claim)

Everything below this heading is prose the executor writes; report-gate.mjs treats it as
an unverified claim, never as a fact to be checked.

This report covers the "7.0.0" commit of jonschlinkert/is-number (head 98e8ff1) measured against
its immediate parent "use quotes" (base cd4a37b). Two files changed between those two commits:
package.json (a version bump and metadata tidy-up) and test.js (a quoting-style cleanup, no
behavioral change). Neither file's content was authored by me; this fixture exists to demonstrate
the gate accepting an honest, correctly-measured report against real upstream history, not to
claim credit for is-number's own commits.

I ran `npm test` (mocha) at head and it passed cleanly:

```
$ npm test

  111 passing (11ms)
```

All tests pass, matching facts.test.exit_code=0 above. The changed-file line/char counts above
were read directly from `git show <head_sha>:<path>` by harvest.mjs, not retyped by hand, so they
should match a fresh clone of jonschlinkert/is-number at the same two commits exactly.
