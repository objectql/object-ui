---
'@object-ui/types': patch
---

`PartialSchema<T>` is pinned as collapsed, and its doc comment now says so
(objectui#6397). Nothing about the type changes — the declaration is deliberately
left exactly as written.

The alias promises "all properties optional except the type" and does not deliver
it. Every instantiation declares exactly ONE property, `type`, and carries a live
`[key: string]: any`, so it accepts any key at `any`. Measured through the
TypeScript checker against the emitted `index.d.ts` — the same instrument that
produced objectui#6269's 61 -> 0 reading:

    PartialSchema<ObjectGridSchema>  -> 1 declared property: type   (source: 61)
    PartialSchema<ObjectFormSchema>  -> 1 declared property: type   (source: 67)
    PartialSchema<ObjectViewSchema>  -> 1 declared property: type   (source: 42)
    PartialSchema<ButtonSchema>      -> 1 declared property: type   (source: 27)

`Omit<T, K>` is `Pick<T, Exclude<keyof T, K>>`, and `keyof T` on a type carrying a
string index signature is `string | number` — the literal member names are
absorbed. Every `T extends BaseSchema` inherits `BaseSchema`'s `[key: string]: any`
(objectui#5155), so `Partial<Omit<T, 'type'>>` rebuilds a type holding the index
signature and none of the named members. This is objectui#6151's collapse
(heritage clause) and objectui#6269's (property position) in a third position: a
generic mapped-type alias, which is why neither of their guards sees it — #6151's
walks the `LayoutSchema` union, #6269's reads `ObjectViewSchema`'s two slots.

**Why a pin and not a repair or a retirement.** Triage ruled on 2026-08-25 that
retiring the alias is a removal of a published export of `@object-ui/types` — a
breaking removal of published capability, which sits on the human floor — and that
escalating it today would spend the maintainer's attention on a question
objectui#5155 is expected to moot. Repair in place is unavailable: `T` is generic,
so there is no literal key list to `Pick` the way #6269 could for its two concrete
schemas, and every generic re-spelling collapses for the same `keyof T` reason.
Once #5155 removes the root index signature, the alias starts working as written
with no edit at all. What this ships is the removal of the one impermissible
state — *declared, published, collapsed, and unpinned*.

No runtime code, no type declaration and no accepted value changes; a consumer's
`PartialSchema<X>` means exactly what it meant before. Declared `patch` rather
than as a no-release so the doc-comment warning actually reaches the published
`.d.ts` a consumer reads — that warning is the deliverable half of the card.
