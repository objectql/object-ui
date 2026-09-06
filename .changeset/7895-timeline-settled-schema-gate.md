---
'@object-ui/plugin-timeline': patch
---

`ObjectTimeline` waits for the object definition instead of querying twice
(objectui#7895).

It was the last member of the set objectui#6482 converged on the shared
settled-schema gate — `ObjectKanban`, `ObjectView`, `ObjectCalendar` and
`ObjectTree` were named there, `ObjectGantt` was ask 2 of objectui#7225 — and
nothing marked it a deliberate exclusion. It still held the object definition in
a local `useState` fed by its own metadata effect, and listed that definition in
the record-fetch effect's dependency array.

**User-visible.** Every object-bound timeline load issued **two** `find` calls
instead of one: the first before the definition landed, with `buildExpandFields`
seeing no fields and therefore carrying no `$expand` at all, and a second one
after. Whenever the metadata read is the slower of the two — the common case on
a cold metadata cache — the second call is not merely a wasted round trip but a
**three-step paint**: raw foreign-key ids, back to the loading skeleton (the
effect's re-run calls `setLoading(true)` and `loading` is an early return), then
the expanded rows. After this change the timeline paints once, from a query that
already carries its expansion.

Measured on the component with an instrumented renderer, one mount per hold,
`getObjectSchema` held 0/1/2/3/4/5/6/7/8/9/10/15/25/50/100 ms, with
`ObjectCalendar` and `ObjectGantt` as positive controls in the same run: before,
2 `find` calls with expand sets `[null, ['owner']]`, 1 paint at the readiness
predicate and 3 late writes after it at every hold from +3 ms up; after, 1 `find`
carrying `['owner']`, 1 paint, 0 late writes, and a first-paint time that tracks
the hold (8 ms at +3, 30 ms at +25, 105 ms at +100) where before it was a flat
3-7 ms at every hold. Both controls read 1 paint / 0 late writes before and
after.

The resolution half is now `useSettledSchema` from `@object-ui/react`, which
settles on **every** exit — no source, no `getObjectSchema`, no object name, and
a read that threw alike. That is what makes the gate safe: the replaced effect
returned without settling on all four, which cost nothing while nothing waited on
it and would have held a gated query open forever. Pinned by
`ObjectTimeline.fetchGate-7895.test.tsx`, including a timeline whose adapter
exposes no `getObjectSchema` and one whose definition read rejects — both still
query, unexpanded.

Unlike the two sibling conversions, the metadata read is **not** disabled for a
timeline whose items were authored inline: this component also reads the
definition's fields for option colours and field labels on that path, where no
record query is issued at all.
