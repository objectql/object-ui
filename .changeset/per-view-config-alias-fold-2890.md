---
'@object-ui/core': patch
---

`normalizeListViewSchema` now folds the four per-view-type config aliases phase 3
carried over — `kanban.groupField` → `groupByField`, `kanban.cardFields` →
`columns`, `gallery.imageField` → `coverField`, `timeline.dateField` →
`startDateField` (objectui#2890).

These are the pre-#2231 objectui spellings, kept declared alongside the spec keys
so stored view metadata would keep validating. They now fold at the same
component boundary as the A1–A5 vocabulary folds, in the same one-directional
shape: the canonical key wins when a config carries both, and the legacy key is
removed from the result so a missed read-site fails loudly instead of quietly
taking the legacy path.

One rendering behaviour changes, and it is a correction of the same inverted
precedence the `densityMode` fold fixed: `ListView`'s kanban adapter resolves the
card field list as `cardFields || columns` — legacy over canonical — so a kanban
config carrying **both** rendered the legacy `cardFields` value and silently
ignored the spec-canonical `columns`. After the fold the authored `columns` is
what reaches it. Configs carrying only one of the two are unaffected, and every
other reader of these four keys was already canonical-first.

`calendar.defaultView` is deliberately **not** folded: it aliases nothing and has
no spec counterpart, so it wants promotion upstream rather than a rename.
