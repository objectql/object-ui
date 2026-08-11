---
'@object-ui/plugin-dashboard': patch
---

fix(dashboard): resolve a dotted dimension's labels on table and pivot dataset widgets

A dataset widget's client-side dimension-label safety net returned early for
`table` / `pivot` / metric widgets, so a DOTTED dimension (`crm_account.industry`)
rendered the raw stored enum (`education`) there — the same symptom objectui#4053
fixed for charts, on the widget types its fix did not reach.

The early return stays for LOCAL dimensions, which is what made it correct in the
first place: on a table the server resolves those labels (ADR-0021), so running
the client net for them would be a second resolution of an already-resolved
value. It now opens only for dotted paths — the case the server is silent on too —
reusing the existing `resolveDimensionFieldOptions` walk unchanged, multi-hop
paths included. A table with no dotted dimension resolves nothing and issues no
metadata read at all, so those widgets render byte-identically.

A pivot's marginal totals take the same relabel as its rows, because their bucket
ids are re-derived from the dimension values that the headers are built from; the
CSV export follows the table's cells for the same reason. Drill-through still
filters by the stored value — the relabel preserves row order and count, so the
raw rows it indexes stay aligned.

Metric widgets are unaffected by design: that branch renders one measure value
and its header label and puts no dimension value on screen, so it has nothing to
resolve.
