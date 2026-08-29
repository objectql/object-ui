---
'@object-ui/plugin-timeline': patch
---

A gantt timeline with an EMPTY literal `items` array renders a zero-row grid instead of
throwing (objectui#6750).

`calculateDateRange` reduced the empty list with no guard: `allDates` is `[]`, `Math.min()`
over no arguments is `Infinity`, and `new Date(Infinity).toISOString()` throws `RangeError:
Invalid time value` during render. Both entry points crashed identically — `TimelineRenderer`
given `{ variant: 'gantt', items: [] }`, and `ObjectTimeline` given the same schema (an
authored empty array is truthy, so it passes straight through as authored items).

An empty gantt is the **ordinary empty state of a valid schema**, not a malformed document.
Any author or generator that builds `items` from a collection emits `items: []` the moment
the collection is empty — a filtered project list with no matches, a fresh workspace, a plan
whose rows are yet to be added.

The fix covers the whole gantt branch in one pass rather than the one `throw`, because
patching only the crash site moves it two stops down the same branch:

- `calculateDateRange` returns a one-day sentinel range anchored on today when the rows carry
  no dates at all. The span is one day — the smallest coherent range — because how much time
  an empty gantt should show is a question about what an empty gantt should look like, which
  this change deliberately does not answer.
- `generateTimeScaleHeaders` needed no change, and that is a measured verdict rather than an
  assumption: a degenerate `min === max` range is not inverted, so the loop runs once and
  every scale emits exactly one bucket. The empty gantt therefore gets a real one-column axis,
  not a header row with zero cells.
- `calculateBarDimensions` gains a `totalDuration === 0` guard. A zero-width axis — every task
  starting and ending on the same day, or an author pinning `minDate === maxDate` — divided
  `0 / 0` into `NaN`, and the bar was handed `left: NaN%; width: NaN%`. That is not a crash
  and not a visible error: the CSSOM rejects both declarations, so React left the element with
  no `style` attribute at all and the bar rendered unpositioned and zero-width. On a zero-width
  axis every task covers the whole of it by definition, so the guard returns `{ start: 0,
  width: 100 }`.

An author-pinned `minDate` / `maxDate` is untouched by the sentinel: the gantt branch resolves
`schema.minDate || dateRange.minDate`, so a pinned range with `items: []` renders exactly that
range with no rows in it — most likely what the author wanted, and free.

**No product judgment about what an empty gantt should look like.** "Do not crash" is a
correctness floor; whether the empty case should become the repo's standard empty-state panel
instead of a zero-row grid is a separate, still-open question, and substituting one here would
have been taking a decision that was left open on purpose. objectui#6655's object-bound gantt
refusal is also untouched and stays keyed on whether items were authored, which is precisely
why it does not fire on this case.
