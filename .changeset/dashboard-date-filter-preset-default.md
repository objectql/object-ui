---
"@object-ui/core": minor
---

fix(dashboard): a date globalFilter's preset-name default becomes a range, not an equality

Setup → System Overview rendered EVERY KPI tile as 0 while its period selector
read "All time" (objectstack#4475). Every request was `200 OK`, the widgets
rendered normally, and nothing in the UI signalled a failure — zeros read as
"nothing has happened yet" rather than as an error, which is why this survived
to an RC.

Both symptoms are one missing normalization. `resolveDashboardFilterDefs` lifts
the built-in `dateRange` declaration's preset NAME to `{ preset }`, but passed a
`globalFilters` entry's `defaultValue` through raw. `@objectstack/spec`'s
`GlobalFilterSchema.defaultValue` is `string | number | boolean`, so a bare
preset name is the ONLY spelling an author can write — and nothing ever mapped
it. System Overview declares
`{ field: 'created_at', type: 'date', defaultValue: 'last_7_days' }`, so:

- `buildFilterCondition` fell through to its "a bare string date means equality
  on that day" branch and the widget sent
  `runtimeFilter: { created_at: 'last_7_days' }`. The backend compiled
  `SELECT COUNT(*) AS "user_count" FROM "sys_user" WHERE created_at = $1`
  — verified against a live server, byte-for-byte the SQL in the issue. The
  actual `sys_user` count is 4; that equality matches no row.
- `DateRangeFilter` derives its selected item from `value.preset` / `.from` /
  `.to`, all `undefined` on a bare string, so the control fell through to its
  ALL sentinel and displayed "All time" while sending that equality. The tiles
  therefore looked deliberately unfiltered and merely empty.

`normalizeDateDefault` now applies the same lift the sibling `dateRange`
declaration already receives, for `date`/`dateRange` filters whose default names
a preset this module actually knows. This is not consumer-side leniency: it is
one normalization function completing the same conversion for the sibling
declaration, and the spec admits no other spelling for an author to fix at the
producer. A genuine ISO date string still means equality on that day (the
documented behaviour), and numbers, booleans and unrecognised strings are left
exactly as declared.

No backend change is needed: given a real range the dataset path already lowers
it correctly (`WHERE (created_at >= $1 AND created_at < $2)` → 4). The
framework's dashboard metadata needs none either — it is spec-compliant as
written, and editing it would only hide the defect.

Levelled `minor` rather than `patch` because the change is visible in rendered
dashboards rather than internal: any dashboard declaring a date-typed
`globalFilters` default now emits a different query shape, its numbers change
(from 0 to real values), and its filter control's displayed label changes with
them. Anything asserting on the previously-emitted condition will see it move.

Known residual, filed separately rather than widened into here: a `date` filter
whose value is neither a known preset nor a parseable ISO date still degrades
silently to an equality that matches nothing, producing the same
healthy-looking zero. Preset names are covered by this change; a misspelled
custom value is not.
