---
---

Test-and-tooling change only; no published behaviour changes. The four pins that read
"which component keys does `packages/layout/src/index.ts` register?" now share one reader
(`scripts/component-registrations.mjs`) instead of four copies of a regex that accepted a
single-quoted key and nothing else — a double-quoted registration was legal, lint-clean
and invisible to all four at once (objectui#4894).
