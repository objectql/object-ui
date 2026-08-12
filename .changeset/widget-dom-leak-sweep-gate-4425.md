---
---

Internal only — a new test-only measurement gate, no source change, so no release.

objectui#4425 phase 1: the #3291 DOM-leak canary sweep, generalized beyond
`packages/fields` to the registry-reachable SDUI widgets of `plugin-charts`,
`plugin-calendar`, `plugin-chatbot` and `plugin-dashboard`. New suite:
`packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx`, 39 cases over
23 measured targets. Home chosen by the #4409 dependency-direction method —
`app-shell` is the only package declaring all four targets, and it already hosts
this repo's cross-package gates.

Per the phase-1 ruling this changes no widget contract and no widget source. The
5 leaking targets it found are RECORDED in the gate's ledger with the exact
attribute names, the mechanism, and an owning issue — never silently baselined.
The ledger asserts exact set equality, so a new leak fails the gate and a FIXED
leak also fails it until its row is deleted in the same change; a row cannot
outlive the defect it records.

Filed from the measurement: objectui#4431 (plugin-chatbot, 14 attributes on two
registrations), objectui#4432 (`DashboardRenderer`'s widget grid, 13), and
objectui#4433 — not a leak but a crash, where authoring the ordinary SDUI
`events` key takes `calendar-view` down entirely. objectui#4434 records the
judge duplication this PR deliberately accepted.

Phase 2 — whether the `toDomProps` whitelist becomes the SDUI widget contract
generally — stays with the maintainer, now decidable on this gate's reading
rather than on an assumption.
