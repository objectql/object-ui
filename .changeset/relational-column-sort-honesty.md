---
"@object-ui/core": patch
"@object-ui/components": patch
"@object-ui/plugin-list": patch
"@object-ui/plugin-detail": patch
"@object-ui/i18n": patch
---

fix(list,detail): sorting a lookup column no longer orders by an invisible key — #3096

A relational column (`lookup` / `master_detail` / `user` / `tree`) never holds
the string its cell shows: it holds the `$expand`-ed record, or a raw foreign-key
id whose label was resolved separately. Every sort path took that raw value as
its key, so the column of names came back in an order with no relation to the
names — sorting looked broken, with nothing saying the key was something else.

The two halves are fixed differently, because they can order by different things:

- **Client-side sorts** (grid column headers, any `data-table`, a non-windowed
  related list) now key off the label the cell renders, via the new
  `getSortValue` / `compareSortValues` in `@object-ui/core` — which resolves an
  expanded record through `getRecordDisplayName` (ADR-0079), so the sort key and
  the lookup cell agree on which field names a record. This replaces two broken
  comparators: `a[col] < b[col]` is always false between two objects (the
  comparator collapsed to a constant and permuted the rows), and
  `String(a[col])` is `"[object Object]"` (every row compared equal, so the sort
  silently did nothing).
- **Server `$orderby` sorts** cannot be fixed here — the key is the stored id by
  construction, and `objectstack#4256` settled that no relation join is coming.
  So those entry points stop offering the illusion: the ListView toolbar sort
  picker withholds relational fields and explains why (pointing at a formula
  field as the supported way to sort by a related name), and a windowed related
  list renders no sort button for them.

A relational field the view's CURRENT sort already uses stays listed, labelled
`(by ID)`, so view metadata authored or saved with such a sort round-trips
instead of rendering a blank row and losing the sort on the next edit.
