---
'@object-ui/app-shell': minor
---

Studio formula fields get the CEL editor: the field inspector's formula textarea is now the same lint + autocomplete editor as conditional rules, running in the new `role: 'value'` mode (scope `record`, roots `['record']`) with an inferred result-type affordance — the `@objectstack/formula` verdict dataset measure eligibility keys off. Edits land on the spec's `expression` key (migrating the engine-dead legacy `formula` key) and stamp `Field.returnType` from the proven type. Summary fields drop the dead formula textarea for a structured `summaryOperations` roll-up editor, and `validateMetadataDraft('object')` now lints every formula expression draft-wide.
