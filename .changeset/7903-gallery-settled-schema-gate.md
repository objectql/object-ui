---
'@object-ui/plugin-list': patch
---

`ObjectGallery` waits for the object definition instead of querying twice
(objectui#7903).

It sat outside the set objectui#6482 converged on the shared settled-schema gate
— `ObjectKanban`, `ObjectView`, `ObjectCalendar` and `ObjectTree` were named
there, `ObjectGantt` was ask 2 of objectui#7225 and `ObjectTimeline` was
objectui#7895 — and nothing marked it a deliberate exclusion. It still held the
object definition in a local `useState` fed by its own metadata effect, and
listed that definition in the record-fetch effect's dependency array.

**User-visible.** Every object-bound gallery load issued **two** `find` calls
instead of one: the first before the definition landed, with `buildExpandFields`
seeing no fields and therefore carrying no `$expand` at all, and a second one
after. The first paint was therefore a grid of cards rendered from raw
foreign-key ids. After this change the gallery paints once, from a query that
already carries its expansion.

Measured on the component with an instrumented renderer, one mount per hold,
`getObjectSchema` held 0/1/2/3/4/5/6/7/8/9/10/15/25/50/100 ms, with
`ObjectCalendar` as a positive control in the same run: before, 2 `find` calls
with expand sets `[null, ['owner']]` at every hold, the issue order always
`schema:issued, find(unexpanded), schema:settled, find(expanded)`, two distinct
painted states, 3 late writes into the card grid after the first paint, and a
first-paint time flat at 3-7 ms across the whole sweep; after, 1 `find` carrying
`['owner']`, one painted state, 0 late writes, and a first paint that tracks the
hold (9 ms at +3, 15 ms at +10, 35 ms at +25, 106 ms at +100). The control read
1 `find` carrying `['owner']` and a hold-tracking first paint both before and
after.

The cost this component was paying is a **two**-step paint, not the three-step
one `ObjectCalendar` and `ObjectTimeline` each measured: those make `loading` an
unconditional early return, so their re-run drops back to a placeholder in
between, while this component's early return is `loading && !items.length` — the
raw ids were replaced in place. Measured here rather than inherited from the
matching shape, which is objectui#6482's own per-component standard.

The resolution half is now `useSettledSchema` from `@object-ui/react`, which
settles on **every** exit — no source, no `getObjectSchema`, no object name, and
a read that threw alike. That is what makes the gate safe: the replaced effect
returned without settling on all four, which cost nothing while nothing waited on
it and would have held a gated query open forever. Pinned by
`ObjectGallery.fetchGate-7903.test.tsx`, including a gallery whose adapter
exposes no `getObjectSchema` and one whose definition read rejects — both still
query, unexpanded.

Two departures, each judged for this component rather than copied. Like
`ObjectTimeline` and unlike `ObjectCalendar` / `ObjectGantt`, the metadata read
is **not** disabled for a gallery whose records were authored inline: this
component reads the definition on every path, for cell semantics and for ADR-0079
card titles, not only to expand a query. And the gate window now holds the
loading placeholder rather than showing "No items to display", which the two
siblings get from their initial `loading` state and this one did not.
