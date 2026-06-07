---
"@object-ui/fields": minor
---

Line-item grid: inline validation, duplicate, and drag-to-reorder.

- **Inline per-cell validation** — a required, non-computed cell that's empty on a real (non-ghost) row flags red in place (`aria-invalid` + ring), so errors are visible without submitting.
- **Duplicate row** — a hover Copy action clones a line (id stripped) directly below it, for near-identical lines.
- **Drag-to-reorder** — a hover grip handle reorders rows via native drag-and-drop. Set `sort_field` on the grid config to persist order (`row[sortField] = index` stamped on every change); otherwise reorder is order-of-entry.
