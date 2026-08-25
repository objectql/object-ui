---
---

CI-only change: no published package's `src/` changed.

Drops the hard-coded case counts from the two step names in
`.github/workflows/hook-selftests.yml` (`guard-main-checkout-bash self-test
(100 cases)` / `guard-shared-stash self-test (32 cases)` → the bare names).
Nothing derived those numbers and nothing re-checked them, and a step name has
no runtime behaviour, so a stale count could only ever show a wrong number on
the checks page. Each run's own tail already prints `N passed, N failed`, and
`guard-shared-stash.sh`'s header carries its count with the recipe to
re-derive it. The `Cost` note keeps its counts, restated as a dated
measurement (`2026-08-24` @ `53dc89db8`) — history, not a live claim — and a
new header section records why the two are treated differently. What the
workflow runs is unchanged: same job, same steps, same `run:` commands.
