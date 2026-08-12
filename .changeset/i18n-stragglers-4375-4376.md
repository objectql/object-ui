---
'@object-ui/fields': patch
'@object-ui/i18n': patch
'@object-ui/plugin-list': patch
---

i18n: the two search placeholders become pack values, and four values the packs served in English get translated

**objectui#4375** — `ListView` and `LookupField` built their search placeholder as
`t(key) + '...'`, so the ellipsis was a literal concatenated in code: it stayed ASCII
in all ten locales on screens where objectui#3878 had converged everything else on
U+2026, and no pack could opt out of it (sharpest in `ar`, where a left-to-right run
was appended to right-to-left text). Both now read `table.search`, which is already
the repo's search-input placeholder key — `data-table`, `RecordPickerDialog` and
`PeoplePicker` render it too — and is translated with the right ellipsis in all ten
packs. No new keys.

**objectui#4376** — `list.loading` served the English `Loading records…` in eight of
the nine translation packs (`zh` alone had translated it); `designer.undo` and
`designer.redo` were English in all nine; `appDesigner.snakeCaseHint` in `ko`, `pt`,
`ru` and `ar`. All translated, reusing each pack's own established vocabulary. A new
pin (`untranslated-identity-4376.test.ts`) fails on any value byte-identical to `en`
inside a non-Latin pack unless the key is on an explicit 22-entry allowlist.
