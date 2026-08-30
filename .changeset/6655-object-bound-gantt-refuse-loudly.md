---
'@object-ui/plugin-timeline': patch
---

An object-bound timeline with `variant: 'gantt'` refuses loudly instead of
throwing (objectui#6655).

The two timeline item shapes are not interchangeable, and this path crossed
them. `ObjectTimeline` maps each record to a flat FEED item — one per record,
no nested `items` — while the renderer's gantt branch reads a gantt ROW
(`row.items[].startDate`). Every `row.items` was therefore `undefined`,
`calculateDateRange` reduced an empty list, `Math.min()` over it was `Infinity`,
and `new Date(Infinity).toISOString()` threw `RangeError: Invalid time value`
mid-render. There was no guard and no diagnostic — the component simply threw.

Per the maintainer ruling of 2026-08-29, the object-bound path now rejects
`variant: 'gantt'` with an author-facing diagnostic naming the limitation
(object-bound timelines render the feed variants; gantt needs literal rows, each
carrying its own nested items). Composing real gantt rows from records was
considered and NOT adopted; that capability stays open and unruled.

The refusal keys on whether the items were AUTHORED, not on the variant alone,
so a literal gantt is untouched — including the bare `timeline` key that this
component answers, which is what the in-repo catalog fixture
`plugin-timeline/gantt-style-timeline.json` uses. The feed variants
(`vertical` / `horizontal`) and the presentational `TimelineRenderer` are
unchanged.

Side effect the ruling asked for: the gantt-only axis this path composes
(`timeline.scale ?? scale`) is no longer silently inert on the gantt variant —
an author who set it is now told why it has no effect, rather than getting a
crash.
