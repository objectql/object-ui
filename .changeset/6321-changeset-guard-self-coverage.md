---
---

Internal CI-only change: `changeset-guard.yml`'s `paths:` filter now includes its own
YAML and `scripts/check-changeset-no-major.mjs`, so a change to the gate is exercised by
the PR that makes it instead of by the next unrelated `.changeset/**` PR (objectui#6321).
`content/docs/guide/ci-cd-pipeline.md` is updated to match. No published package changed.
