---
---

Test-only change: pin the objectui#7696 cell — a LOCAL select dimension on a dataset
CHART widget — with the card's own fixture, plus a control that fires. No published
behaviour changes; nothing outside `packages/plugin-dashboard/src/__tests__/` is touched.

The card modelled the analytics option-label coverage as a 2x2 and reported the
chart/local-select cell as left open by both objectui#4030 (PR #4324) and objectui#4330
(PR #4388). Measured on `origin/main`, that cell was closed by PR #4324 itself: a chart
has always resolved EVERY dimension (PR #4388's `dottedOnly = isTable` removal widened
the TABLE path, not the chart one), and `buildDimensionLabelMap` keys the AUTHORED label
beside the stored value, which is what re-translates a row the server already resolved.
The pin added here says so in the card's own terms so the next reader of the 2x2 gets an
answer from `git grep 7696` instead of re-deriving it.
