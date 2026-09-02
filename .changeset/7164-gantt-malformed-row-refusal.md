---
'@object-ui/plugin-timeline': patch
'@object-ui/types': minor
'@object-ui/i18n': patch
---

A gantt timeline whose rows are malformed now refuses to draw, naming the row,
instead of crashing the render (objectui#7164, maintainer ruling A+).

`TimelineRenderer`'s gantt branch used to read the authored rows twice — once
defensively in `findUnusableGanttDate`, once bare in `calculateDateRange` — and
every input in the gap threw a `TypeError` mid-render from ordinary JSON:
`items: [null]`, a row whose `items` is `5` / `true` / `{}` / an array-like
object, or `items` itself not an array. The three readers (the date scan, the
range computation and the render loop) now consume ONE verdict from
`classifyGanttRows`, and a malformed shape renders the existing `role="alert"`
refusal through a new diagnostic key,
`timeline.gantt.unusableRange.malformedRow` — "items[0] is null, which is not
a row shape" — never the `malformedDate` copy, which named the wrong fault.
The key lands in `en` and the nine sibling locale packs.

`@object-ui/types` (minor — the accept set narrows): `TimelineSchema.items` no
longer declares `z.array(z.any())`. Every element must be an object, and a
gantt row's own `items`, when present, must be an array, so `validate` refuses
`items: [null]` and `items: [{ items: 5 }]` at authoring time — before they
reach a renderer. Feed items (`vertical` / `horizontal`) carry no `items` key
and parse exactly as before; every in-repo `type: 'timeline'` fixture parses
green on both sides of the change. Rows with no bars (`items: []`, a row
without `items`) stay the ordinary empty state and still draw.
