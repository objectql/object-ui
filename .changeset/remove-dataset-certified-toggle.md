---
"@object-ui/app-shell": patch
---

fix(metadata-admin): remove the unwired "Certified" measure toggle from the dataset designer

`measure.certified` is dead in the spec liveness ledger (declared but read by
nothing — no certifier authority, no provenance, not surfaced at point-of-use).
A self-asserted checkbox the dataset author flips on their own work isn't
certification — it's a fake trust signal. Drop the toggle (and the create
default) until real metric governance exists (separate `dataset.certify`
authority + `certifiedBy`/`certifiedAt` + a badge where reports pick measures).
The spec field stays (dormant, liveness=dead) so existing data is untouched.
