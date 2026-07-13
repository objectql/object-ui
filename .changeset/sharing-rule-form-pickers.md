---
"@object-ui/fields": minor
"@object-ui/components": minor
"@object-ui/data-objectstack": minor
"@object-ui/types": minor
---

Sharing-rule form: pick, don't type. Three new widget-hint field components make
the generic object form render pickers where an admin previously had to type
machine data (driven by the framework `widget` hints on `sys_sharing_rule`;
generalizes the `capability-multiselect` pattern). All degrade to the underlying
`type` renderer when a widget is unregistered.

- **`object-ref`** — choose a registered object by name (searchable `Combobox`),
  backed by the new `DataSource.getObjects()` (`ObjectStackAdapter` lists code-
  and DB-defined objects via `/api/v1/meta/object`), falling back to a
  `sys_metadata` query. Stores the object's `name`.
- **`filter-condition`** — a visual criteria builder (`FilterBuilder`) scoped to
  the fields of the object chosen in a sibling field (via `getObjectSchema`),
  round-tripping the stored **MongoDB-style** FilterCondition JSON. Criteria the
  builder can't represent (or invalid JSON) fall back to a raw-JSON editor, with
  an always-available "Edit as JSON" toggle — nothing is hidden or lost.
- **`recipient-picker`** — a record picker whose target object follows a sibling
  `recipient_type` (`user`→sys_user, `team`→sys_team, `business_unit`/
  `unit_and_subordinates`→sys_business_unit, `position`→sys_position), storing the
  value the evaluator matches on (a record id, or the position **name**). Resets
  the stored id when the type changes.

Wiring: the three keys join `DATA_SOURCE_FIELD_TYPES` (form.tsx) so the form
threads `dataSource` + `dependentValues` to them, and `INLINE_EXCLUDED_FIELD_TYPES`
(they're authored in the record form, not a grid cell). `DataSource.getObjects()`
is optional on the interface; the ObjectStack adapter implements it.
