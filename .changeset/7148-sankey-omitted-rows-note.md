---
'@object-ui/plugin-charts': patch
---

A sankey that drew only SOME of its rows now says how many (objectui#7148).

The sankey arm keeps strictly positive measures
(`data.filter((r) => (Number(r?.[dataKey]) || 0) > 0)`), so a mixed dataset
drew a normal, healthy, confident chart of a fraction of itself and nothing
anywhere recorded that the other rows existed. Measured in Chromium across 27
tiles: `[{New business: 40}, {Refunds: -25}, {Chargebacks: -12}]` rendered
`svg: 1`, `path: 3`, 18 descendants, no `role`, no text, and — against a live
console control that did fire on the same instrument — zero console output.
Its screenshot hashed byte-identical to five other datasets, one of which
genuinely had a single row. Six datasets, one image: a reader had no bit of
information separating a complete flow from a third of one.

The discard itself stands — a flow has no negative width, so it is the only
thing that arm can do with those rows. What is added is a footnote under the
plot naming the ratio and the predicate the filter applies:

> Showing 1 of 3 rows — 2 rows have no `amount` above zero, which a flow
> cannot draw.

It names the predicate rather than a cause because `Number(…) || 0` folds
negatives, zeros, `null`, unparseable strings and a missing key into one
discard, and all five were measured reaching this branch beside a survivor;
naming any one of them is a sentence that is false for the other four.

A complete flow is byte-for-byte unchanged and gains no wrapper element, and a
drawable sankey is never replaced by prose: the `no-positive-flow` refusal
still owns the case where NOTHING survives the filter, and the "one positive
among zeros still draws" boundary still draws — that fixture is itself a
thinned dataset, so it now draws *and* says so.
