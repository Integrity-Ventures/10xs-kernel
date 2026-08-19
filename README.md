# 10xs-kernel

We don't ask you to trust AI-written code. We ask you to run the gate.

An agent-updated kanban board is free everywhere now. What nobody ships is the other half: an
independent verifier that is the sole writer of `done`, re-measures every claim from origin,
refuses evidence-less work, and leaves a third-party-readable receipt. The board is where you
watch the work. **The gate is the thing.** This repo is that gate, extracted so you can run it
against your own agents.

## The one command

The gate runs today from a clone of this repo. The `npx` form is what it becomes the day the
package is published — it is not on npm yet:

```bash
# from a clone of this repo (works now):
node bin/10xs.mjs check --report <path-to-completion-report> --base <git-ref>

# once published:
npx @10xs/kernel check --report <path-to-completion-report> --base <git-ref>
# exit 0 — the report survived re-measurement
# exit 1 — it did not; findings print to stdout
# exit 2 — usage error
```

## Paste this into your agent's system prompt

```
Before claiming a task done, run `10xs harvest --mt-id <id> --base <ref> --out <dir>`
and use its output as the top of your report, unedited. Never state a sha, test count, file size, or pass/fail claim
you did not have the tool measure — if you need a new fact, re-run the harvester.
Put reasoning and any claim the tool can't check under the heading
"## Executor narrative (unverified claim)"; everything below it is read as prose,
never as fact. Before you claim done, run `10xs check` yourself and paste the exit
code. Exit 1 means fix the report, not the gate.
```

## What it catches

A real run, not a hypothetical: DeepSeek invented a head sha naming no commit, a 39-character
base sha, and a "verified by running npm test" claim for a test it never ran. `report-gate` fired
RG002×2 + RG003×2 and the run exited 1 — with no human involved. Source:
`engineering/workflow/active_session_handoffs/20260801_04_s366_gov2_tool_fix_round.md`.

## Scope

Ships: `spec/` (what a unit of work is), `verify/` (harvest + gate the claim), `verdict/` (what a
grade means), `runtime/` (the audit/generation engine two production Lambdas import). Does not
ship: a board, a planner, a checker service, anything hosted, any UI. `ssr-content`, `check-files`,
`lambda`, and `build` stay monorepo-only gates — they check a specific product's build, not a
generic claim. `runtime/` is included for readers; per its own `tsconfig.json`, it does not
type-check standalone outside the monorepo yet.

## How this repo was built

Human-directed, AI-coded, every change through the gate above before it merged. Maintenance is
fleet-triaged and human-directed, not unattended. The architect-error ledger (an internal record,
not yet public) and the DeepSeek run above are the receipts for that claim; this repo's own commit
history is the receipt for this repo — for example, the commit that added `runtime/`:
<https://github.com/Integrity-Ventures/10xs-kernel/commit/1894c164084586d729496c6e6a4983a2562185ed>.
PRs must carry a claim the gate can re-run — see `CONTRIBUTING.md`.

## Licence

MIT — see `LICENSE`.
