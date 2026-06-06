---
"@object-ui/plugin-form": minor
---

feat(master-detail): derive child columns + relationship FK from metadata

A master-detail child collection can now be configured with **just the child
object name** — the relationship FK and the editable grid columns are derived
from the child object's schema (via `DataSource.getObjectSchema`), instead of a
hand-authored columns block.

```ts
// before: ~40 lines of columns + relationshipField
details: [{ childObject: 'task', relationshipField: 'project', columns: [ ...12 lines... ] }]
// after:
details: [{ childObject: 'task' }]
```

- `relationshipField` is auto-detected from the child's `master_detail`/`lookup`
  field that references the parent (master_detail preferred).
- `columns` are derived from the child's fields, skipping system/audit fields,
  the back-reference FK, and non-editable types (formula/summary/autonumber/
  file/json/…); select options and lookup references carry through.
- `amountField` (running-total source) defaults to the first numeric/currency
  column.
- Any of these can still be set explicitly to override the derived defaults.
- Save is gated until derivation resolves; new pure helpers
  (`deriveDetail`/`deriveColumns`/`findRelationshipField`) are unit-tested.
