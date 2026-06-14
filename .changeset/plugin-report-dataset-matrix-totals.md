---
"@object-ui/plugin-report": minor
---

feat(plugin-report): server-supplied totals in dataset matrix reports

Pairs with the framework's server-side `queryDataset` totals. The matrix renderer
now requests `totals: { groupings: [rows, columns, []] }` and renders the
returned pre-aggregated rows — a trailing Total column per measure (row
subtotals), a trailing Total row (column subtotals), and the grand total at their
intersection — matched to pivot headers via the same `bucketId` logic. A response
without totals (older server) renders exactly as before; the client never
re-aggregates (ADR-0021).
