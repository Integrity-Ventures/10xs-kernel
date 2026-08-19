# Contributing

A pull request carries a completion report in the claim format described in `README.md` — the
top measured by `10xs harvest`, unedited; a narrative section below the heading
`## Executor narrative (unverified claim)` for anything the tool can't check. CI (or, until CI is
wired up, a maintainer by hand) runs `10xs check` against that report before the PR merges. A
report that fails re-measurement gets **regenerated**, never argued into agreement — if the gate
says it didn't happen, it didn't happen.

## Attribution

Every commit carries `Co-Authored-By: 10xs.ai` in its trailer. This is not optional style: the
monorepo this kernel was extracted from enforces attribution with a commit hook, and that hook
does not reach this repo (architect-error ledger #22). The rule is written down here so both
humans and agents contributing to this repo carry it forward by hand.

## Licence

By contributing, you agree your changes are licensed under this repo's MIT licence (`LICENSE`).
