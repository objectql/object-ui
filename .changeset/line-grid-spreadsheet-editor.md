---
"@object-ui/fields": minor
"@object-ui/plugin-form": minor
---

Spreadsheet-style line-item grid editor.

`GridField`'s editable grid mode is reworked into an enterprise line-item editor (the QuickBooks / Stripe / NetSuite pattern), generalised across every inline grid:

- **Computed read-only columns** — a child field with an arithmetic `expression` (e.g. `amount = quantity * unit_price`) renders read-only, recomputes live as its inputs change, and writes the result back into the row so it persists and the running total reflects it. A small safe arithmetic evaluator (`+ - * / %`, parens, `record.<field>` refs; no `eval`) powers it.
- **Trailing "ghost" row** — start-with-one + auto-append: typing in the ghost materialises a real row (index-stable, so focus/caret survive), so you keep entering lines without clicking "Add".
- **Borderless click-to-focus cells** + role-based column widths (description flexes; qty/price/amount stay narrow).
- **Keyboard navigation** — Enter / ArrowUp / ArrowDown move between rows in the same column.
- Per-row "expand to full form" is gated to grids that omit fields (no redundant expand on thin lines).
- `deriveColumns` surfaces a field `expression` as a computed column; the running-total column prefers the computed/last-currency column. Blank/ghost rows are filtered from the persisted batch (`isBlankRow`).
