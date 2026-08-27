---
'@object-ui/types': minor
'@object-ui/plugin-dashboard': patch
---

Land objectui#6425's per-key ruling for `ObjectDataTable`'s authored column
override keys (maintainer, 2026-08-27):

- **Declare `format`, `options`, `currency`** on `TableColumn` and its
  `TableColumnSchema` zod mirror, in the same stroke. All three are honoured
  by `object-data-table`'s cell pipeline — `format` / `options` were
  documented author overrides the published types refused (a typed author got
  a compile error and the zod parse silently stripped the key); `currency`
  shipped in production but was never promised. The zod mirror now passes the
  keys through instead of stripping them; `StaticTableColumn` and its mirror
  tombstone all three under the #5474 lockstep rule (the static renderer
  reads no field-meta overrides).
- **Retire `decimals`**, immediately: zero readers measured anywhere
  (`NumberCellRenderer` reads `scale`, `PercentCellRenderer` reads
  `precision`), so no authored `decimals` could reach a render. The authored
  read is removed and the key falls into `AuthoredColumnOverrides`' derived
  refusal band — render output is pinned unchanged.
- **`referenceTo` is deliberately NOT declared as spelled** — it stays held,
  owned by objectui#6597 (fix the spelling chain or withdraw the README
  line). The remaining hold is that card's scope, not unfinished work here.
