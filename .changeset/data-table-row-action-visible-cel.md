---
'@object-ui/components': patch
---

Data-table row menu: honor each custom row action's `visible` (and `disabled`) predicate.

The data-table's inline row overflow menu — used by a record detail page's related list — rendered every custom row action unconditionally, ignoring the action's `visible` CEL. ObjectGrid's row menu already evaluates `visible` per row (`RowActionMenuItem`), so the two row-menu paths disagreed: on an organization's Members tab, `sys_member`'s `transfer_ownership` action (`visible: "record.role != 'owner' && …"`) showed on the owner's own row.

Each custom action now renders through a hook-safe `DataTableRowActionItem` that mirrors `RowActionMenuItem`, evaluating `visible`/`disabled` with `useCondition`/`toPredicateInput` against the same per-row context (`{ ...row, record: row }`); `features`/`user` resolve from the ambient `ExpressionProvider` scope, so gating matches the grid. Rendering-layer only — the action definitions are unchanged.
