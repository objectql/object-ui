---
---

CI-only change: no published package's `src/` changed.

Adds `.github/workflows/hook-selftests.yml`, a new PR/push gate over
`.claude/hooks/*.selftest.sh` — the hermetic self-test matrices for the
PreToolUse guards behind the worktree-first and never-`git stash` rules. Runs
on any PR touching `.claude/hooks/**` or the workflow itself; fails the build
the moment either matrix goes red. Does not modify the hooks or their
self-tests. Paired writes: `content/docs/guide/ci-cd-pipeline.md` (workflow
inventory) and `scripts/dependabot-merge-gate.mjs` (classifies the new check
as `OPTIONAL_CONTEXTS`, following `Changeset Bump Policy`'s path-filtered
shape).
