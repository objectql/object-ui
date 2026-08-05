---
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
'@object-ui/i18n': patch
---

Localize the last untranslated console-chrome accessible names (objectstack#5430)

Four icon-only controls still carried hardcoded English accessible names, so
under a non-English session they were the only English left in the record
chrome — and because the controls have no visible label, that literal *is* the
control to a screen reader and to the hover tooltip.

- `page:header`'s `role="toolbar"` — now `detail.pageHeaderActions` (its `⋯`
  overflow trigger eight lines below was fixed in #5407; the toolbar was missed)
- `ReactionPicker`'s `role="listbox"` popup — now `detail.emojiPicker`
- `ReactionPicker`'s per-reaction chip, which built its name by concatenation
  with English pluralization baked in (`reaction${count !== 1 ? 's' : ''}`) —
  now `detail.reactionCount` / `detail.reactionCountOne`
- `NavigationOverlay`'s drawer close and split-panel close — now `common.close`
  (the key the rest of the console already uses) and `common.closePanel`

The pluralized label follows this repo's **two-key** convention
(`detail.relatedRecords`/`relatedRecordOne`, `lookup.recordCount`/`recordCountOne`)
rather than an i18next `_one`/`_other` pair: zh/ja/ko have no separate singular
form, so those packs would legitimately omit the `_one` half and
`all-locales-key-parity` would read that as a lost key.

All five new keys are added to all ten locale packs.
