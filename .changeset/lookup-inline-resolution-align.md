---
"@object-ui/fields": patch
---

fix(fields): align inline lookup value resolution with the read cell (external-id strings, tolerant id match)

Follow-up to #2125. `LookupField`'s inline display now resolves every value
shape the read cell (`LookupCellRenderer`) does:

- **JSON-encoded external-id references** (`'{"externalId":"Website Relaunch"}'`)
  are parsed and shown by their external id, and excluded from the hydration
  fetch (so we never `findOne` with a raw JSON string). `recordToOption` gained
  an `externalId` fallback for both the value and the label.
- **Tolerant id matching** — a `String()`-coerced fallback (`findOptionLoose`)
  resolves a numeric cell value against a string-keyed option (and vice versa),
  matching the read cell's `String(a) === String(b)` comparison. Only consulted
  when the strict match misses, so homogeneous option lists are unaffected.

Also adds explicit inline-editor tests for `user` / `owner` fields (they
delegate to `LookupField` via `UserField`), completing coverage for the full
relational set wired inline in #2122.
