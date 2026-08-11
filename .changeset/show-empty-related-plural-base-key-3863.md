---
'@object-ui/i18n': patch
'@object-ui/plugin-detail': patch
---

`detail.showEmptyRelated` renders Russian and Arabic again — the "+N empty" button no longer falls through to English at the counts it takes most often

This was the repo's only pre-existing i18next plural family, and all ten packs defined exactly two slots: `_one` and `_other`. i18next asks `Intl.PluralRules` for the one suffix a language needs for that number, and when the pack has no such slot it walks `fallbackLng` to `en`. Russian has four plural categories and Arabic six, so `ru` at counts 2-4 (`few`) and 5-20, 25-30, … (`many`), and `ar` at 0, 2, 3-10 and 11-99, resolved nothing locally and rendered the English string. The call site is the collapsed-empties button in the record detail's reference rail, whose count is the number of empty related lists — 2 to 4 are the most common values it ever takes, so a Russian user essentially always read English.

The fix is a base key (no suffix) beside the two existing slots, in all ten packs. The base key is always in i18next's lookup chain, so every category a pack did not enumerate resolves to it, in that pack's own language — and, unlike adding `_few`/`_many` to `ru` alone, it keeps the ten packs' key sets identical, which full key parity requires. Same shape objectui#3546 slice six established for `perm.facet.*`. Where the base key is genuinely reachable it carries a count-invariant phrasing: `ru` uses the «Существительное: {{count}}» form the pack already writes 22 times, `ar` the «{{count}} مفرد(جمع)» marker it uses throughout. For `en`/`de`/`zh`/`ja`/`ko` the base key cannot be reached at all (their categories are covered by the two existing slots) and repeats `_other` for parity; `fr`/`es`/`pt` reach it only from a million up, where the plural form is already correct. No English copy moves.

The provider-less path needed the same row for a different reason: `createSafeTranslation`'s fallback resolves `defaults[key]` literally and never appends a plural suffix, so the two suffixed rows in plugin-detail's defaults table were unreachable through it and that path answered with the raw key. It now carries the base key too.

Parity across packs turned out to be necessary and not sufficient — ten identical key sets were green throughout, because the defect is one level below key names: the slot the language needs is not in the set. So the invariant "a plural family must carry a base key" is now asserted over all ten packs in `all-locales-key-parity.test.ts`, where it is pack-intrinsic and fails at PR time without needing a call site to exist. It went red on all ten packs before this change and names the family that is missing its base.
