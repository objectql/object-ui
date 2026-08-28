---
'@object-ui/plugin-list': patch
---

`list-view` stops spelling "the author declared no columns" as an explicit empty
projection (objectui#6598).

A production `kind:'html'` page carried `<list-view objectName="opportunity">`
with no `columns` and rendered the row count, the filter/group/sort toolbar and
the index column — and **not one data column**, with no diagnostic anywhere.
`ObjectGrid` derives default columns for exactly that case ("Default columns
priority (when schema doesn't specify columns)"), and it never ran: the
derivation is gated on `schema.fields` being ABSENT, `ListView` sent
`fields: []`, and an empty array is truthy. `normalizeColumns` had already read
the empty `columns` as unauthored, so the two keys disagreed about the same fact
and the stricter reading won.

`ListView` now asks whether the AUTHOR declared a projection — `columns` present
and non-empty, after the legacy `fields` fold — and hands the child grid nothing
at all when they did not, so the grid's own defaults apply.

⚠️ The predicate reads the authored value and never what survived filtering, and
that distinction is load-bearing: when the author DID declare columns and the
field gate removed every one of them, the empty projection is still sent.
`ObjectGrid` re-applies FLS on its derived column path only, never on the
explicit-columns path, so falling through to the derivation there would put
fields on screen that the author never asked for and the principal may not read.

Measured single-variable on the html tier: a bare
`<object-grid objectName="opportunity" />` renders the object's default columns;
the same object behind `<list-view>` rendered none. Pinned at the handoff
(`ListView.unauthoredColumnProjection-6598.test.tsx`) and end to end over the
real grid on a real html-kind page
(`htmlTierListViewDefaultColumns-6598.test.tsx`).

This is one half of the reported symptom. Which columns the defaults resolve to
still depends on who owns the fetch — with a host like `ListView` fetching, the
grid takes its inline-data branch and derives from the row payload's keys rather
than from the object schema's policy (hidden and readonly system-managed fields
dropped, `highlightFields` honoured). That precedence sits in
`packages/plugin-grid` and is filed separately.
