---
---

CI-only: the Bundle Analysis PR comment now names *which* eager-closure half
objected, instead of reporting only that something did.

`scripts/check-eager-closure-budget.mjs` evaluates three halves and publishes a
verdict for each to `$GITHUB_OUTPUT` — `closure_status` (the aggregate ceiling),
`closure_chunk_status` (the per-chunk ceilings) and `closure_headroom_status`
(ceiling sensitivity). `.github/workflows/performance-budget.yml` passed only
the first into the comment step, so the two others were published and never
read. The step's exit code folds all three into one `budget_status`, which meant
the comment could say a budget objected but not which half — a reader had to
open the job log to learn whether the total grew, one chunk grew, or a ceiling
had stopped measuring anything.

- Both missing verdicts are now passed into the comment step and rendered.
- The healthy comment is unchanged: the breakdown appears only when a half is
  not `pass`, verified byte-for-byte against the previous renderer.
- A drifted ceiling (exit 2) reads as a broken **gauge** rather than a size
  failure, and no longer claims "nothing was measured" while showing two
  ceilings that passed.
- `render-budget-comment.test.ts` now fails if the checker publishes a
  `closure_*` verdict the workflow does not wire through, so a fourth half
  cannot repeat this.

The exit-code mapping is untouched: exit 2 still maps to `budget_status=error`,
any other non-zero to `fail`, and `error` still outranks `fail` across all three
halves.
