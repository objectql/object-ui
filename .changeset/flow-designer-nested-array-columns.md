---
"@object-ui/app-shell": minor
---

feat(app-shell): nested-array columns in the flow designer property form (#2678 P2-5)

The server-driven node property form (`configSchema` → `FlowConfigField`) now
renders **nested arrays** inside an `objectList` repeater instead of degrading
them to a plain text cell that `String()`-joined and corrupted the array on
save. A repeater column whose item property is itself an array becomes a
**nested repeater** (repeater-in-repeater):

- `json-schema-to-fields` `columnsFor` maps an array-typed item property to a
  `stringList` / `numberList` / `objectList` column; object-array columns derive
  their own nested columns recursively (bounded by a nesting cap so a
  pathological / cyclic schema can't build a non-terminating form). Arrays that
  still aren't representable fall through to the prior text behavior — no
  regression.
- `FlowConfigColumn` gains the three list `kind`s plus a recursive `columns` for
  nested `objectList`.
- `FlowObjectListField` renders those columns via the shared `FlowStringListField`
  (string/number lists, with `number[]` coercion) and a recursive
  `FlowObjectListField` (object lists), round-tripping each cell as an array.

Any engine-published node config with a nested array is now editable inline
rather than dropping to the Advanced JSON escape hatch.
