---
'@object-ui/plugin-grid': minor
---

fix(plugin-grid): cross-page "select all N matching" replays the host's real query — or abstains — instead of fanning out unfiltered

`resolveBulkRows` re-issues the view's query in 500-record pages so a bulk action
receives the whole match set rather than the visible window. The query it
replayed came from `lastFindParamsRef`, whose only writer is ObjectGrid's own
data loader. Under a host that fetches the rows itself — ListView passing `data`
plus `manualPagination` and `rowCount`, which is what the console does — that
loader never runs, so the ref was not the query behind the rows on screen:
absent, or stale from an earlier own-fetch. Either way the `?? {}` default let
the fan-out ask the server for the WHOLE OBJECT — no `$filter`, no `$orderby`,
no `$search` — and hand up to 5000 unmatched records to a destructive executor
(`onBulkDelete`) while the bar read "All N matching records are selected".

The host now hands its query down as the new optional `findParams` prop on
`ObjectGridExternalPaginationProps` (the same shape the internal loader stores),
and the fan-out reads whichever side owns the fetch. There is deliberately no
grid-side default: when no query is available for the current data path the
escalation is **not offered at all** — a host that forgets `findParams` loses
the affordance rather than silently collecting the whole object, which is what
makes the unfiltered fan-out structurally unreachable rather than merely
currently-wired-right. A changed `findParams` also resets the escalation,
mirroring the `setSelectAllMatching(false)` the internal loader runs next to its
own params write, so "All N matching" cannot survive the host's filter, search,
sort or page changing; the comparison is by content, so a host re-render that
rebuilds an equal object does not drop the user's escalation.

The internal-loader path is unchanged: with the ref populated the fan-out issues
the same params it always did, and the `selection.type: 'single'` suppression is
untouched.
