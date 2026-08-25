---
'@object-ui/i18n': patch
'@object-ui/plugin-designer': patch
---

`appDesigner.fieldDesigner.formula` is retired — one row removed from each of the ten
locale packs plus the designer defaults map, 11 lines, zero readers (objectui#6310).

objectui#6043 retired the Field Designer's formula-expression textarea, which was the
key's only call site (`FieldDesigner.tsx`, the `{ name: 'formula', label:
t('appDesigner.fieldDesigner.formula') }` field descriptor). The value outlived it in
eleven places: `DESIGNER_DEFAULT_TRANSLATIONS` in
`packages/plugin-designer/src/hooks/useDesignerTranslation.ts`, and the `appDesigner >
fieldDesigner > formula` leaf of `packages/i18n/src/locales/{en,de,es,fr,pt,ru,ja,ko,zh,ar}.ts`.

Removed under objectui#4658's evidence standard, re-measured on this branch rather than
inherited from the card: zero `t()`/`tt()` call sites, no dynamic template head that could
reach it (`appDesigner.fieldDesigner.typeCategory.` is the namespace's only one), and its
sole textual occurrence anywhere in the repo was the defaults-map row this change removes
with it — so the key goes from NEEDS-REVIEW to no footprint at all.

The map and all ten packs move in one commit, which is what keeps
`defaults-maps-mirror-en-pack` green: that gate fails a map row whose key the `en` pack
lacks, and `all-locales-key-parity` fails a pack left behind.

Not touched: `designer.field.formula` (`'Formula (CEL)'`) in
`packages/app-shell/src/views/metadata-admin/i18n.ts`, a different and live key belonging
to metadata-admin's `ObjectFieldInspector` — the surface that still authors formula
expressions.

`packages/i18n/src/__tests__/appDesigner-fieldDesigner-formula-retired-6310.test.ts` pins the
removal by name, following the four prior retirements (objectui#4145, objectui#4392,
objectui#4730, objectui#5504). Every i18n gate here runs call site → key, so none of them can
see a dead key come BACK into the packs: the reverse sweep that found this one is report-only
by design, `all-locales-key-parity` is fully satisfied by ten packs agreeing on a dead key, and
`check:i18n-drift` only fires when a value changes. Reverse-verified rather than asserted —
reviving the row in all ten packs turns exactly that one case red, naming each pack, while the
parity gate and the defaults-map mirror stay green.
