---
---

Pin the i18n call-site gate's factory abstention counters on `main`
(objectui#8423). The factory half of `scripts/check-i18n-call-site-keys.mjs`
prints `factoryRowsNoEnKey`, `factoryUnjudgedRows` and its matching/compared
pair on every run and held none of them to anything, so `factoryRowsNoEnKey`
moved 5 to 0 when objectui#7887 retired the `timeline.relative.*` rows and
nothing failed. The main-line case now mirrors the three lines the hand-rolled
half already pins, keeping the existing `factoryTables > 25` and
`factoryComparedRows > 500` lower bounds so the zeros stay readings rather than
"the scan found nothing". Test only; no package is released by this change.
