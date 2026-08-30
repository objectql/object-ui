---
---

Tests only, no release: pin the synth → renderer seam for the default
`fieldGroups` record detail page (objectui#6241).

`buildDefaultPageSchema` synthesizes one detail section per declared
`fieldGroups` entry and app-shell's `RecordDetailView` renders that output as
the default record page for every object declaring `fieldGroups` with no
assigned page — but nothing asserted end-to-end that those synthesized sections
render their headings. The synthesizer's own suite asserts its return value and
never renders; the `record:details` renderer suites render hand-authored
section fixtures and never consume synthesizer output. Measured on `9ea4cdee3`:
with the consumer's read of the emitted heading removed, all 109 files / 1031
tests of `packages/plugin-detail/` still passed.

The new file renders the real `buildDefaultPageSchema` output through the real
registry into the DOM and asserts the declared heading TEXT, its declared
order, and that a group's internal key never stands in for its label. It
asserts no key spelling, so it stays independent of the `title` / `label`
convergence open in objectui#6190 / objectstack#11661.
