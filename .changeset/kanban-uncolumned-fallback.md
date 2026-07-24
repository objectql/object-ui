---
"@object-ui/plugin-kanban": patch
"@object-ui/i18n": patch
---

fix(kanban): surface off-column records in an "Uncategorized" lane instead of dropping them (#2792)

Records whose `groupBy` value matched no declared column were bucketed and then silently discarded — the board rendered empty while the list footer still counted the rows, so it read as data loss (a status the board doesn't render, an edited/removed picklist option, imported legacy data, or an empty value all triggered it). They now land in a trailing "Uncategorized" lane so no record is invisible and the visible card total reconciles with the record count. Dragging a card out of that lane into a real column repairs its status; the drag handler refuses to persist a move *into* the lane (its sentinel id is not a real option). Adds `kanban.uncategorized` to the en/zh bundles.
