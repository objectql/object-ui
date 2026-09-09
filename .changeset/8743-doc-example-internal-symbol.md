---
---

CI tooling only, no published package source changed: `check:doc-examples` now
probes a second injection candidate — the built declaration of the documented
symbol's own module — so a deliberately package-internal symbol's `@example` can
compile without widening any published surface (objectui#8743).
