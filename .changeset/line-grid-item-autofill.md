---
"@object-ui/fields": minor
---

Line-item grid: item-typeahead auto-fill from a lookup column.

When a lookup cell's record is picked, `GridField` now copies any of the chosen record's fields whose names match a sibling column (e.g. a product's `unit_price` / `description` drop into the row), then recomputes computed columns — the catalog-typeahead behaviour of QuickBooks / Stripe / NetSuite. Opt out per column with `autofill: false`. `LookupField` gains an optional `onSelectRecord(record)` callback that surfaces the full selected record (not just its id). New pure export `lookupAutofillPatch(columns, col, record)`.
