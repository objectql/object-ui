---
---

Tooling only, no package released: port `scripts/check-entry-guard.mjs` from objectstack and wire it into `Lint`, so a `scripts/**` entry guard hand-typed with `process.argv[1]` cannot land. The 29 guards this tree already carries are baselined SHRINK-ONLY and converted separately (objectui#6092).
