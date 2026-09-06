---
'@object-ui/app-shell': patch
---

Forward the authored `chart:` block WHOLE from the object-view relay to `ListView`
(objectui#7823).

`ObjectView`'s `renderListView` builds the list schema by spreading the object's list
schema and then relaying the active view's visualization blocks under `options`. Every
sibling block is forwarded whole; `chart` was a hand-listed projection of exactly six
keys — `chartType`, `xAxisField`, `yAxisFields`, `aggregation`, `series`, `config` — the
pre-ADR-0021 key set, frozen. The whole ADR-0021 (objectui#1890) authoring shape
(`dataset` / `dimensions` / `values`) and the legacy `categoryField` / `valueField`
spelling had no rung, so a view that declared them reached `ListView` with its binding
stripped, and `ListView` could not tell that from a view that had declared nothing.

**What changes for authors.** On the object-view route, a list view that declares an
ADR-0021 chart block and whitelists `chart` in `appearance.allowedVisualizations` is now
offered the Chart toggle and renders from the dataset it named. Before this fix the
capability gate added by objectui#7544 was handed six `undefined` keys, correctly
answered "nothing declared" about a view whose author had declared everything, and
ADR-0047 filtered the author's own whitelist down to `['grid']` — no toggle, no
diagnostic. The legacy `xAxisField` / `yAxisFields` spelling did survive the projection
and did resolve, so the two authoring shapes behaved differently on this route for
reasons that lived entirely in that one object literal.

**Not a wider whitelist.** The projection is replaced by a pointer, not extended from
six keys to nine: a hand-listed key set is a copy, and copies rot silently — three more
keys would buy ADR-0021's correctness while re-arming the identical trap for the next
block key, and nothing would fire then either, because the relay's view definition is
`Record<string, any>` and a missing rung is invisible to `tsc` (objectui#7559 owns that
mechanism). Forwarding whole is safe because `ListView` reads this block by name at both
of its readers — the capability gate's `resolveListChartBinding` and the `chart` render
branch — and never spreads it.

A view that declares no chart block, an empty block, or a block with no binding at all
is still offered no Chart toggle: the relay now forwards `undefined` instead of the old
permanently-truthy husk of six `undefined` keys.
