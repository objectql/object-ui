---
"@object-ui/i18n": patch
"@object-ui/components": patch
"@object-ui/app-shell": patch
---

fix(i18n): retire four hand-rolled zh/en branches (objectui#2871, part 1)

Four surfaces decided their language with a hand-written `startsWith('zh')`
check instead of the locale packs, so the other eight shipped languages
silently rendered English and the strings could never be translated without a
code change.

- **`RecordTitleChip`** carried a private zh-CN/zh-TW dictionary behind a
  comment claiming "components is i18n-free". That is not true —
  `@object-ui/components` declares `@object-ui/i18n` and its sibling
  `containers.tsx` already uses it. All four of its keys (`detail.copied`,
  `detail.copyRecordId`, `detail.addToFavorites`, `detail.removeFromFavorites`)
  already existed in **all ten packs**, so this deletes ~35 lines and fixes ten
  locales with zero new translations. It renders on every record detail page.
- **`EnvironmentListToolbar`**'s three state-aware CTA labels move to a new
  `environment.*` namespace. This surface had already regressed once for the
  same reason (#844) and was fixed then with inline `{en,zh}` pairs.
- **`StudioAiCopilot`**'s dock title moves to the Studio catalog as
  `engine.studio.aiCopilot`.
- **`StudioHomePage.relativeTime`** now uses `Intl.RelativeTimeFormat` with
  `numeric: 'auto'` instead of five `zh ? … : …` ternaries. This is strictly
  better than adding ten catalog keys: it covers every locale, applies the
  correct plural rules, and yields "yesterday" / 「昨天」 rather than "1d ago".
  Arabic gets its dual form («أسبوعين») — something a ternary cannot express.

The new `environment.*` keys are added to all ten packs, so this does not widen
the gap tracked by objectui#2872 part (a).

`EnvironmentListToolbar`'s tests now render inside a real `I18nProvider` pinned
to `en`. Without one, `t()` returns the raw key, so the previous assertions on
literal English would have been asserting nothing.
