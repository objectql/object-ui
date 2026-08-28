---
---

Test-only comment refresh in `registry-inputs-spec-parity.test.ts`: the
`record:reference_rail.entries` exemption note no longer narrates the
`ReferenceRailEntry` `icon` divergence as an open contract question (ruled
Option B 2026-08-22, objectui#5494 landed the derivation from
`@objectstack/spec/ui`), and drops the "the renderer reads it" premise that was
false when written. The exemption itself is unchanged — `inputs` is a flat
scalar carrier and still cannot express an array of objects. No published
behaviour changes.
