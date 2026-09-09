---
'@object-ui/plugin-kanban': patch
---

The kanban board no longer announces "No cards" before it has the records
(objectui#8827).

`KanbanImpl` paints `DataEmptyState` — a `role="status" aria-live="polite"`
live region titled **No cards** — whenever the board holds zero cards across
more than one lane. That predicate is an assertion *about the data*, and the
component was making it before it had the data.

`KanbanRenderer` loads `KanbanImpl` behind `React.lazy`, so the chunk's arrival
and the records' arrival are two unordered events (this is objectui#8534's
second half; the mirror half was closed by PR #8825 and is not this). On the
production shape — lanes derived synchronously from `schema.columns`, rows
arriving from `ObjectKanban`'s query — the two orderings were measured on
post-#8825 `main` and they diverge. When the data wins, the Suspense skeleton
covers the whole window and nothing is announced. **When the chunk wins,
`KanbanImpl`'s first committed frame carries the authored lanes with zero cards
and announces a false "No cards" to assistive technology while the rows are
still in flight.** The only thing hiding it was the lazy skeleton happening to
be slower than the fetch, and nothing makes it slower.

## What changed

The empty-state predicate now hangs on **settled**, not on "zero rows".
`ObjectKanban` derives whether the records it is drawing have settled and hands
that to `KanbanImpl` through a **package-private context** — not a member of
the published `KanbanRendererProps`, and emphatically not a member of its
`schema` bag, which `BaseSchema`'s passthrough would make reachable by an
author (the shape objectui#7742 / decision batch #70 moved `objectFields` off).
Nothing here reaches the published surface.

The signal is a **keyed resolution**, not a boolean, following
`useSettledSchema`'s shape for the same reason it has that shape (objectui#6271
/ #7225): a bare boolean takes the same value for "not started" and
"finished". `ObjectKanban`'s existing `loading` state is exactly that boolean —
in standalone mode it initialises `false` and is only set `true` inside the
fetch effect, so the first frame still reads `loading === false` and wiring it
into the predicate would have fixed nothing.

The per-lane `kanban.noCards` placeholder takes the same gate. It renders the
same string, and on a single-lane board the board-level predicate never
runs — so gating only the live region would have left the false claim alive on
exactly the boards the live region never covered.

## What did NOT change

**A genuinely empty board still paints `DataEmptyState`.** The reverse
regression — "gating on a truthy definition would leave those boards empty
forever", named in `ObjectKanban.tsx` itself — is what the settle contract
exists to prevent, and every exit settles: the query succeeding, the query
throwing, no readable source, the non-fetch record sources (external, bound and
inline data are settled from the first frame), and the schema-only `kanban-ui`
entry, which has no `ObjectKanban` and therefore no provider and so takes the
context's **settled** default. Lanes, headers, counts and drop targets keep
rendering while the rows are in flight; only the claim is withheld.

No chunk boundary moved, no bundle changed, and no first paint was delayed —
ordering the chunk against the data (which would trade first-paint time for
first-frame correctness) remains open on objectui#8827 and is not done here.
