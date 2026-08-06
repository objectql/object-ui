---
'@object-ui/components': patch
'@object-ui/i18n': patch
---

Localize the record-overlay and tab-badge chrome that #5430's sweep left behind (objectstack#5506)

Four more console-chrome strings were still hardcoded English literals. Unlike
#5430's set they are not all accessible names — one is visible copy, and one was
a component **default** that only the console happened to override.

- `page:tabs`' count badge built its `aria-label` by template literal,
  `` `${formatTabCount(count)} items` ``. The badge renders digits only, so that
  label *is* the badge to a screen reader — and the English plural was baked in
  with no singular branch at all, so a related list with one row announced
  "1 items". Now `common.itemCount` / `common.itemCountOne`.
- `NavigationOverlay`'s drag-resize handle (`role="separator"`, no visible label)
  — now `common.resizeDrawer`.
- `NavigationOverlay`'s `expandLabel` **default**. Hosts may override it and the
  console does, but the default is what every other host ships — and it feeds
  both `aria-label` and `title` of an icon-only button. Now
  `detail.openAsFullPage`, still overridable by the prop.
- `NavigationOverlay`'s `resolvedTitle` fallback, `'Record Detail'` — **visible**
  overlay heading, not just an a11y name. Now `detail.recordDetail`.
- The sr-only `SheetDescription`/`DialogDescription` prose
  `Record detail overlay for {title}.`, which existed in three copies
  (drawer / modal / popover) — now one `detail.recordDetailOverlay` key with a
  `{{title}}` placeholder.

The count badge follows this repo's **two-key** plural convention
(`detail.reactionCount`/`reactionCountOne`, `detail.relatedRecords`/`relatedRecordOne`)
rather than an i18next `_one`/`_other` pair: zh/ja/ko have no separate singular
form, so those packs would legitimately omit the `_one` half and
`all-locales-key-parity` would read that as a lost key. The formatted count
(`1.2k`, not `1200`) is interpolated so the accessible name and the visible
digits never disagree — and because i18next skips its own plural resolution when
`count` is a string, the two-key scheme stays in charge of the choice.

Both touched components moved from `useSafeTranslate` to `createSafeTranslation`,
which carries an options bag (two of the new keys interpolate) and an English
defaults map. That map is what keeps the provider-less path English, which
consumers outside this package depend on — `plugin-view`'s `ObjectView.test.tsx`
and `e2e/live/inline-edit-polish-2572.spec.ts` address this chrome by English
accessible name with no `I18nProvider` mounted.

All six new keys are added to all ten locale packs.
