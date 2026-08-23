---
---

CI only — this publishes nothing, declared explicitly with an empty frontmatter rather
than left undeclared.

`ci.yml`'s `Test (coverage)` job no longer uploads to Codecov. `CODECOV_TOKEN` was never
set on this repository and Codecov no longer accepts tokenless uploads, so the step failed
server-side (`Token length: 0`) on every push after objectui#5403 landed — a permanently
red lane that trains everyone to ignore red. Per the maintainer ruling of 2026-08-22
(Option B), the upload is retired rather than the secret set: the merged report is now
published as the `coverage-report` build artifact (7 days, matching the shard blobs it is
derived from) alongside the existing step summary.

The coverage GATE is untouched and was never Codecov's: the configured
`coverage.thresholds` are enforced by the merge step over the whole merged map, and the
shard legs still override them to zero so that merge step remains the only place the gate
runs. objectui#5403's loud verdict step is carried forward rather than deleted — it now
reports `shards=… blobs=… merge=… report=…` and is green only when all four shards passed,
all four blobs arrived, they merged, the thresholds were enforced over the result, and the
report was published. A threshold breach is annotated separately from a lane that never
delivered, because the two call for opposite actions.

What is given up is the Codecov trend dashboard and its PR coverage comments.
