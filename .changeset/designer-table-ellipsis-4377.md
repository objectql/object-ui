---
'@object-ui/app-shell': patch
---

fix(app-shell): the metadata-admin designer's own i18n table uses the typographic ellipsis

The designer carries its own flat `en`/`zh` table rather than reading the ten locale
packs, so objectui#3878 — which converged those packs on U+2026 `…` per the
consistency pass on objectstack#6015 — left it behind. Ten values across five keys
(`engine.form.select`, `.selectObjectDots`, `.addObjects`, `.selectFieldDots`,
`.addFields`) still ended in three ASCII full stops, and the designer renders inside
the console shell, so `Select...` sat on screen beside the packs' `Select…`.

All ten now use `…`, and the table's header records the convention for the next
author.
