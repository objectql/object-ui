---
---

CI-only change: `ci.yml`'s workflow `concurrency` group now carries `github.sha` on
the `push` trigger, so a merge to `main` no longer cancels the previous merge's
still-running CI. The `pull_request` group (the PR number, `cancel-in-progress: true`)
and the `merge_group` fallback to `github.ref` are both unchanged.

The push lane is the only lane that runs the coverage gate, and the merged 4-shard
report is what enforces `coverage.thresholds` for a commit. Measured over the 64
completed push-lane runs on `main` between 2026-08-23T06:34Z and 2026-08-24T13:56Z,
39 of them — 61% — lost that gate to cancellation rather than to a red suite.

No published package changes.
