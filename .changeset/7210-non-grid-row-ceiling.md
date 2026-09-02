---
'@object-ui/react': minor
'@object-ui/i18n': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-tree': patch
---

A non-grid view's fetch now carries a platform row ceiling, and crossing it is
never silent (objectui#7210, maintainer ruling a′, 2026-09-02).

Before this, `ObjectGantt`, `ObjectCalendar`, `ObjectMap` and `ObjectTree` each
issued a `find` with **no `$top` at all**, so the request returned the entire
filtered result set. At the 186 rows the card was filed from that is invisible;
on an object with 100k scheduled rows it is the whole table into the browser,
and nothing an author could write — `pagination.pageSize` included — could
bound a request that never carried a cap to begin with.

**What changed.** Those four fetches now ask for `NON_GRID_ROW_CEILING_TOP`
rows, draw at most `NON_GRID_ROW_CEILING` of them, and when the result set was
larger they render a footnote naming both numbers: *"Showing the first 2,000 of
41,234 records. Narrow the filter."* Below the ceiling nothing changes: the full
set draws and no footnote appears.

**The ceiling is a platform constant, not an authorable key** — `2000`, exported
from `@object-ui/react` as `NON_GRID_ROW_CEILING`. An authored `limit` or
`dataSource: { limit }` still does not reach these queries, by the same ruling;
three alternatives were rejected with it (a documentation note only — still the
whole table; truncating at `pageSize` — silent, and a complete schedule capped
at one page; an authorable `maxRows` — a new permanent key every author sets).

**Why 2,000.** One constant for all four, so the binding view sets it. Measured
in this repo's jsdom lane: gantt, calendar and map hold their DOM flat as rows
grow (virtualised task list; four events per day cell; auto-clustering above
100 markers), while `ObjectTree` flattens every expanded node into the document
at a linear **5.2 DOM elements per record** with no virtualisation. 2,000 rows
is where the worst of the four lands at ~10,400 elements — an order of
magnitude above Lighthouse's "excessive DOM size" warning, and still ~10x the
real application result set this card came from.

New exports on `@object-ui/react`: `NON_GRID_ROW_CEILING`,
`NON_GRID_ROW_CEILING_TOP`, `applyNonGridRowCeiling`, `NonGridRowCeilingNote`.
Two new `common.*` i18n keys carry the footnote copy in all ten packs.
