---
---

CI-only change: no published package's `src/` changed.

`.github/workflows/hook-selftests.yml` now **discovers** the matrices it runs
instead of hand-enumerating them. Its single step runs
`find .claude/hooks -type f -name '*.selftest.sh' | sort` and executes each hit,
so a new `.claude/hooks/**/*.selftest.sh` is picked up with no edit to the
workflow — the property the file's own header already claimed ("the standing
caller for `.claude/hooks/*.selftest.sh`", whose matrices "are meant to grow in
`.claude/**` WITHOUT this file being touched") and did not have: the previous
`steps:` were a hand-kept list, and `guard-tree-enum.selftest.sh` had to be
added to it by hand while the sibling repo's collector picked the same file up
automatically.

Ported from objectstack's collector in its `lint.yml`, keeping both load-bearing
properties: an **empty** discovery is RED (a step that verified nothing is not a
pass, so a renamed or moved directory cannot degrade the gate into a silent
no-op), and the loop **tolerates and collects** rather than sequencing, so one
red matrix cannot abort the run and hide the others — it still fails the job and
names every matrix that failed.

Coverage is unchanged, measured rather than asserted: discovery returns exactly
the three self-tests the removed steps ran, and no self-test file was moved,
renamed or skipped. Does not modify the hooks or their self-tests (`.claude/**`
is governed surface). Paired write:
`content/docs/guide/ci-cd-pipeline.md` (the workflow's own section hand-listed
two of the three matrices). `scripts/dependabot-merge-gate.mjs` was read and
left untouched — its `OPTIONAL_CONTEXTS` description of this check is already
count-free.
