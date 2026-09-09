---
---

Test-only change (objectui#8071, first declared slice). Registers per-block member
pins for `object-form.fields` and `object-grid`'s `exportOptions`, `bulkActions`
and `bulkActionDefs`, deletes their four `MEMBER_PIN_EXEMPTIONS` entries and
lowers `MEMBER_PIN_EXEMPTION_CEILING` 62 -> 58. Every touched file is a
`__tests__` file; no published runtime source, no `package.json` publish-contract
field, no behaviour change.
