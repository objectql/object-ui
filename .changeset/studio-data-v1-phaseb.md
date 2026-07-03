---
'@object-ui/app-shell': minor
---

Studio Data pillar Phase B — Validations & Settings views complete the Data v1 surface (builder-ui pillars):

- **Validations view**: no-code editing of `ObjectSchema.validations` `script` rules (name / message / CEL fail-condition via the metadata-admin ConditionBuilder, fed the DRAFT field list / severity / active / delete). Non-script rule types (state_machine, format, …) stay visible read-only so the list remains a truthful inventory. New rules default to a VALID never-firing `condition: 'false'` — an empty condition 422s the whole draft save and dead-ends the create flow.
- **Settings view**: object basics via the shared metadata-admin default inspector (one implementation for both surfaces) plus direct editors for the ADR-0085 semantic roles — `nameField`, `stageField` (incl. the `false` "not a linear flow" state) and ordered `highlightFields` chips.
- **Draft-only packages fixed in the rail**: the object list now merges `listDrafts()` headers, so a freshly-created writable base shows its draft objects instead of hanging on "加载中…"; the empty state now says the package has no objects yet.
