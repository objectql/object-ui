---
"@object-ui/plugin-form": minor
"@object-ui/fields": minor
"@object-ui/components": minor
---

Master-detail subform + lightweight list primitives (SDUI).

- `MasterDetailForm` (`object-master-detail-form`): enter a parent record and its child line items together; client-orchestrated transactional create (parent → FK → bulk children → rollup → cleanup). Enterprise-convention layout (header on top, line grid, single Save bar at the bottom).
- `LineItemsField` editable child grid (line numbers, right-aligned numerics, running total) and `LineItemsPanel` (`record:line_items`) for detail-page inline edit.
- `element:definition-list` and `element:repeater` — lightweight, low-chrome list primitives for simple data.
