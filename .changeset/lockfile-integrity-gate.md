---
---

Internal tooling only: a new CI lockfile-integrity gate (`scripts/check-lockfile-integrity.mjs`),
its workflow, its test suite and its `ci-cd-pipeline.md` section. No published package source, no
publish-contract field and no `apps/console` executable source is touched, so nothing here changes
any released artifact — declared explicitly rather than left to inference (objectui#8326).
