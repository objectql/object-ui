---
---

Test-only: fixed a flaky race in `plugin-dashboard`'s DatasetWidget dotted-dimension
tests, where `waitFor` was bound to a rendered cell while the assertion checked a
separately-resolving metadata fetch recording (objectui#4487). No published behaviour
changes.
