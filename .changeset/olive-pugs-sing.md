---
'@object-ui/plugin-dashboard': patch
---

Dashboard record fields: percent columns now render through the one percent
scaling decision instead of a second, drifted copy of it.

`renderFieldValue`'s `%`-format branch normalised the value itself before
calling `formatPercent` (`const normalized = value > 1 ? value / 100 : value`,
then `normalized * 100`). `formatPercent` already applies `percentDisplayValue`,
which `@object-ui/core` documents as the single source of truth for percent
display scaling, so the branch was re-deciding what core owns — and its copy had
drifted from it in three measured ways:

- `(value / 100) * 100` is not value-preserving in binary floating point,
  re-introducing one call frame upstream the round trip that was removed from
  inside `formatPercent`. On the 0.001-step grid to 200, 19,978 of 199,000
  values change bit pattern and 1,108 rendered strings move, every one a
  last-digit off-by-one: a stored `1.605` rendered `1.60%` where half-up is
  `1.61%`.
- A stored fraction below `0.01` was scaled twice — the local `* 100` put it
  back under 1, so core's fraction arm scaled it again. `0.005` (0.5%) rendered
  `50.00%`.
- The local test was `value > 1` rather than core's symmetric `|value| < 1`, so
  a negative already in percentage points took the fraction arm: `-5` rendered
  `-500.00%`.

The branch now hands the raw stored value to `formatPercent` — the identical
call the list-view percent cell already makes for an ordinary percent column —
so a percent reads the same as a record field, as a grid cell and as a dashboard
measure. Output moves where it was wrong: values at or above 1 whose round trip
lost a digit, fractions below `0.01`, negatives at or below `-1`, and exactly
`1`, which is percentage points by core's convention and now renders `1%`.
