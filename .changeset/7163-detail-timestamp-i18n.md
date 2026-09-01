---
'@object-ui/plugin-detail': patch
'@object-ui/i18n': patch
---

`RecordComments` and `PointInTimeRestore` resolve their copy from the locale
packs instead of hardcoded English (objectui#7163).

Both files carried their own `formatTimestamp` whose relative-time branches
returned English literals, so a zh/ja/ar session read `5m ago` next to
otherwise translated chrome — the defect objectui#7142/#7149 fixed one file
over in `ActivityTimeline`.

- **`RecordComments`** was already wired to the packs (11 `t('detail.…')`
  references), so this is a pure lookup swap onto `detail.justNow` /
  `minutesAgo` / `hoursAgo` / `daysAgo` — keys already present in all ten packs,
  each `en` value byte-identical to the literal it replaces. **No new key, no
  copy change.**
- **`PointInTimeRestore`** used no translation hook at all, so it is swept
  WHOLE rather than having only its timestamps converted: card title, empty
  state, field-count line, preview panel, snapshot heading, restore
  confirmation and all three buttons. Wiring one string into an otherwise
  untranslated component is what shipped objectui#7142's visibly half-done zh
  card; that is not repeated here.

Ten new `detail.*` keys land in all ten packs and in
`DETAIL_DEFAULT_TRANSLATIONS`: `revisionHistory`, `noRevisions`,
`revisionFieldsChanged`, `revisionFieldsChangedOne`, `revisionPreview`,
`revisionSnapshot`, `restoreConfirm`, `restoring`, `confirmRestore`,
`restoreToPoint`. `detail.cancel`, `detail.activityEmptyValue` and
`detail.emptyValue` are **reused**, not forked.

The restore confirmation becomes one key with a `{{when}}` hole rather than a
sentence assembled around a JSX expression, and the field-count line uses the
repo's two-key plural convention selected by a static ternary over two literal
keys — never `t(KEYS[n])`, which objectui#7149 measured as invisible to the
i18n scanners.

One deliberate copy change: the snapshot panel's null placeholder was an EN
DASH (`–`, U+2013) written inline and now resolves `detail.emptyValue`, which
is an EM DASH (`—`, U+2014) in all ten packs — the glyph the rest of the detail
package already uses for an empty value.
