---
'@object-ui/core': minor
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-tree': patch
---

One shared record-source ladder, five plugins delegate (objectui#7632).

`@object-ui/core` publishes `resolveRecordSourceConfig(schema)` — the ONE implementation
of the ruled three-rung record source ladder: `data` first, then `staticData` wrapped as
`{ provider: 'value', items }`, then `objectName` folded to `{ provider: 'object' }`, and
`null` when nothing is bound. It is the PRODUCER whose output the objectui#7627 reader
`resolveRecordSourceObjectName` consumes, and it now sits beside it in the same module.

That ladder is published contract on both faces — `packages/types/src/objectql.ts` and its
zod mirror both ship `.describe()` strings naming `getDataConfig`'s order (objectui#6939,
maintainer ruling 2026-09-02), pinned by `objectql-record-source-refinement-6939.test.ts` —
and it was hand-copied into five plugin components with no gate holding them together. A
change to the ruled order had five edit sites and nothing that noticed a missed one; that
is the AGENTS.md #0.1 drift class.

**No behaviour changes.** `ObjectCalendar`, `ObjectGantt` and `ObjectTree` now call the
shared reader directly. `ObjectGrid` and `ObjectMap` keep their own bare-array `data`
shorthand as a documented head above the shared call and are otherwise unchanged.
`record-source-config.behaviourNeutrality-7632.test.ts` transcribes all five pre-collapse
bodies verbatim and asserts the post-collapse spelling agrees with each across the whole
input matrix, so a later edit to the shared reader that moves any site turns red.

**Two divergences were measured rather than assumed, and both are preserved.**

`ObjectCalendar`'s `'data' in schema && schema.data` guards exist because its parameter is
the union `ObjectGridSchema | CalendarSchema` and `CalendarSchema` declares neither key.
That is a TypeScript narrowing device with no runtime effect — an absent property reads
`undefined`, falsy either way — so the guard could never change which rung is taken. The
shared reader's optional-property parameter accepts the union directly, and the
equivalence is pinned on a fixture that really lacks both keys rather than argued.

`ObjectGrid` and `ObjectMap` normalize a bare-array `data` to `{ provider: 'value', items }`;
`ObjectCalendar`, `ObjectGantt` and `ObjectTree` do not, and return the array verbatim. That
is a real divergence on off-contract input — `ViewData` is a discriminated union over object
variants, so an array under `data` cannot be published. It is NOT unified here: the shared
rung stays contract-strict and the two sites keep the head locally, the same way objectui#7627
left the off-contract `{ provider: 'object' }` tails at their sites. Both sides of the fork are
pinned, so neither folding the head in nor deleting it as redundant can happen silently.

`ObjectTree`'s copy took `schema: any`; it now goes through the shared reader's typed
parameter. Types are erased at runtime, so nothing it resolves moves.
