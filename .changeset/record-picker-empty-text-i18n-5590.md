---
'@object-ui/components': patch
---

`element:record_picker`'s `emptyText` now resolves the inline per-locale map its
contract has admitted since rc.6, and its published declaration says so
(objectui#5590).

`@objectstack/spec` widened this key to the `I18nLabel` union
(`string | Record< string, string >`) at 17.0.0-rc.6, and the installed 17.0.0 GA
still carries it — measured, not assumed:
`ElementRecordPickerPropsSchema.safeParse({ object: 'account', emptyText: { en, 'zh-CN' } })`
succeeds. The renderer honoured only the string arm, handing the map straight to a
text node. React refuses a plain object in a child position rather than stringifying
it, so an author writing the map form the contract accepts did not get a mis-rendered
empty state — the whole picker subtree threw
`Objects are not valid as a React child (found: object with keys {en, zh-CN})`.

The read site now resolves through `pickLocalized`, the objectui-side helper the
sibling text-node sites already read through (`element:text.content`,
`element:button.label`, `page:card.title`), which spells a miss as `''` rather than
the spec resolver's `undefined`. The default is applied before resolution, so
`emptyText` absent still means "No records" and an authored empty string still
renders empty.

The `ComponentMeta` entry, which held a single `'string'` arm precisely because the
renderer dropped the other one, now declares `['string', 'object']`. That narrowing
was correct for exactly as long as it was true: with the map arm reaching the screen
resolved, withholding it would be the false declaration in the other direction — the
manifest gate reporting `type-mismatch` on a legal write the same input's own
`description` teaches the author to make. The `apps/console` specimen that pinned the
narrow arm named this release condition in its own words ("keeps its single `'string'`
arm until the render site catches up") and is flipped here, keeping its controls.

Three comments in the renderer deferred this gap to objectui#4163, which closed as
completed on 2026-08-15 while the gap was still open; the file now carries no
reference to it. The `ComponentInput.type` doc in `@object-ui/types` cited this very
key as its worked example of an arm deliberately withheld, and is corrected in the
same change so the example stays true.
