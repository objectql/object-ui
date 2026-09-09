---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

Route the `repeater` and `file` cell COUNT labels through i18n (objectui#8441).

The `repeater` cell in the standard renderer table counted its rows with a hardcoded
Chinese unit word. Two rules broke on that one literal: AGENTS.md #-1 (all user-facing
text MUST be English) and, the half a translation to English would not have fixed, it
bypassed i18n entirely — every reader on every locale read it, English ones included,
beside the English siblings `[Vector]`, `[Grid]` and `FileCellRenderer` on the same
detail page. It now reads `detail.repeaterItemCount` through `useFieldTranslate`, the
channel this file already imported and four of its other cells already use.

`FileCellRenderer` moves with it, to `detail.fileCount`. Its `count === 1 ? 'file' :
'files'` was not a rule violation — it is English — but it was equally unlocalized and
plural-safe for English only: `ru` has four plural categories and `ar` six, and a
two-branch ternary can spell neither. Two adjacent cells answering one concept two ways
is what the single channel closes. **English output is byte-identical**: `2 files`
stays `2 files`, and the provider-less fallback is pinned byte-equal to the `en` pack.

Both keys are REAL i18next plural families — base + `_one` + `_other` in all ten packs,
not the two-sibling-key `xxxCountOne` shape. The base key is load-bearing (objectui#3863):
i18next asks `Intl.PluralRules` for the one suffix a number needs and, finding no slot,
walks `fallbackLng` to `en`, so without it a Russian reader gets English at counts 2-20.

The `repeater` entry also stops being an inline arrow in `getCellRenderer`'s table and
becomes a module-level component. That table is rebuilt on every call and both call
sites resolve inside render, so an inline entry is a fresh component type per render:
React would remount the cell and tear down react-i18next's language subscription with
it. No export was added — the published surface is unchanged.
