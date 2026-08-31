---
---

Test-only. The two `plugin-detail` top-level spec-parity blocks
(`recordDetailsInputs`, `recordRelatedListInputs`) now measure their OWN
schema's strictness against an undeclared top-level key, via a per-file
`specRefusesUnknownTopLevelKeys` probe and a two-arm assertion, instead of
citing the sibling `record:highlights` probe in prose — strictness is per
schema. No published behaviour changes.
