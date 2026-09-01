---
---

Docs-only: records the downstream-consumer census for
`@object-ui/plugin-detail`'s `PointInTimeRestore` as
`docs/audits/2026-09-plugin-detail-downstream-consumer-census.md` (objectui#7175).

objectui#7163 measured that the component has zero *in-repo* consumers. That is not the
same statement as zero consumers, because it is barrel-exported public API, so this audit
reads the downstream populations instead: `hotcrm` measured at `a6be39a3d` (zero on every
spelling, against a positive control of 104 `plugin-detail` node references in the same
repo on the same instrument), and `cloud` reported as **NOT MEASURED** — refused on three
independent channels, two of them beside a live control.

No source, behaviour, or public-surface change; the audit records evidence so the
ADR-0049 enforce-or-remove question can be decided later. It deliberately retires nothing.
