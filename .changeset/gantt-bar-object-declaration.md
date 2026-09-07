---
'@object-ui/types': minor
---

**Declare a gantt BAR as an object on both published faces** (objectui#7365).

`TimelineSchema.items[].items[]` — a gantt row's bars — was `z.array(z.any())`
in the zod mirror and `any[]` on the TypeScript face, so an authored `null` bar
(`{ items: [{ label: 'R', items: [null] }] }`) was green through `validate` and
only met the render-time date diagnostic, which named
`items[0].items[0].startDate is undefined` — a key the author never wrote.

Both faces now declare the same shape objectui#7164 declared one level up: the
mirror's row `items` is `z.array(z.object({}).passthrough())`, and the TS face
states the row/bar shape its docblock previously carried only in prose. A bar
that is not a bar is refused at `validate`, by its own name, at
`items[i].items[j]`.

**Breaking semantics, shipped as a `minor`** (objectui's own breaking changes
are never `major` — the fixed group follows `@objectstack`): this NARROWS a
published accept set. A document with a `null` (or numeric, string, boolean,
array) gantt bar used to `safeParse` green and now fails. In-repo stock measured
before the change on `289d146`: five authored bars across `apps/` · `examples/`
· `content/` · `packages/types/examples/`, all well-formed objects, zero `null`
and zero non-object — positive-controlled, so nothing in this repository moves.

A bar's own keys (`title` / `startDate` / `endDate` / `variant?`) stay
undeclared and open, feed-variant timelines are untouched, and the render-time
`malformedRow` copy and its ten language packs are unchanged.
