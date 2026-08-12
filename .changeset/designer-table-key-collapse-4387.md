---
'@object-ui/app-shell': patch
---

refactor(app-shell): collapse the metadata-admin designer table's byte-identical key pairs

objectui#4377 converged five designer i18n values on the typographic ellipsis `…`. Three
of the five then held values byte-identical to a sibling key in both the `en` and the `zh`
block, so the `Dots` suffix — which used to name "the spelling *with* trailing dots" —
named nothing any more, and one key had no consumer at all:

- `engine.form.selectObjectDots` → collapsed onto `engine.form.selectObject`
- `engine.form.selectFieldDots` → collapsed onto `engine.form.selectField`
- `engine.form.select` → deleted (no call site; byte-identical twin of the live
  `engine.form.selectEllipsis`)

The two live `Dots` call sites in `widgets.tsx` now read the surviving key. Every rendered
string is unchanged — the collapsed values were byte-identical — so this is a table-shape
change only: the designer no longer names one placeholder twice, which is where the next
author would otherwise re-split the dialect.
