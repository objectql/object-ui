---
'@object-ui/plugin-grid': minor
---

fix(plugin-grid): type ObjectGrid's column emit against the `TableColumn[]` slot it fills

`generateColumns()` had no return annotation and all four of its call sites cast
to `any`, so nothing checked what this producer wrote into
`DataTableSchema.columns: TableColumn[]`.

Annotating it is not enough, and that is the substance of the change. Measured on
this program: `generateColumns(): TableColumn[]` raises **zero** diagnostics — the
emit literals reach the annotation through `.map()`, which strips the freshness
that excess-property checking depends on, so even an undeclared key written out
longhand is accepted. Underneath that sits the reason the annotation could not
bite at all: `objectSchema` is `useState<any>`, and an `any` spread into an object
literal collapses the **entire** literal to `any`.

So the fix has three parts: name the four inference locals so `any` stops at the
boundary, carry ADR-0049 `?: never` tombstones **derived** from
`keyof ListColumn` (never hand-listed, so a future spec key is refused by
default), and drop the `any` at every call site — including a fourth the card's
census missed and a fifth (`const generatedColumns: any[]`) inside the producer.

Key verdicts: `headerIcon`, `pinned` and `wrap` are HELD and now declared at the
seam; `options` is RETIRED — nothing on either side of the seam read it, and
every value it carried still reaches its consumer through the field metadata the
cell closure captures and the object schema the inline editor reads. `type` stays
objectui#5853's and `name` is not emitted here at all.

No rendering change.
