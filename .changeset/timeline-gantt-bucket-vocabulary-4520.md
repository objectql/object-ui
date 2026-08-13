---
'@object-ui/plugin-timeline': minor
'@object-ui/i18n': minor
---

The timeline's gantt bucket labels and its row-label default speak the session language

objectui#4513 routed every `Intl` call in the timeline renderer through `useDisplayLocale()`, so a Chinese session renders `2026年8月` on the month axis and `2026年8月11日` on item dates. Three sibling strings in the same renderer never went through `Intl` at all and stayed English on that same Chinese axis: the `week` header (`Week 1`), the `quarter` header (`Q3 2026`), and the gantt row-label column default (`Items`). The half-fixed state was the visible one — a Chinese date axis with English bucket labels beside it.

They are a translation concern rather than a locale-resolver one, and that distinction is the fix: a locale TAG formats a date, only a TRANSLATION spells a word. All three now resolve through the package's existing channel — `useTimelineTranslation` / `TIMELINE_DEFAULT_TRANSLATIONS`, the `createSafeTranslation` factory `ObjectTimeline` already uses for `timeline.bucket.*` — under three new keys carried by all ten locale packs: `timeline.scale.week`, `timeline.scale.quarter`, `timeline.gantt.rowLabel`.

The week number and the quarter/year ride the channel's own `{{hole}}` parameters rather than being concatenated, because the word order belongs to the translation: Chinese puts the year first (`2026年第3季度`), which no `Q${q} ${year}` template can produce at all. Only the row-label DEFAULT moved — an author who writes `rowLabel` still supplies their own string, and the `year` scale stays a bare `String(getFullYear())` with no vocabulary in it to translate.

English output is byte-identical to the retired literals: the `en` pack values are the same two templates the code used to interpolate by hand. `generateTimeScaleHeaders` is a pure exported function and cannot host a hook, so the translate fn is threaded in as an optional fifth parameter on the seam #4513 opened for `locale`, defaulting to the package's own defaults table — the same lookup the channel serves with no `I18nProvider` mounted. Existing three- and four-argument call sites are unaffected.

One consequence is worth stating because it looks like a bug and is not: dates and vocabulary resolve through different channels on purpose. `useDisplayLocale()` puts the tenant's regional default first (how this organization writes dates), while `t` follows the UI language (what this user reads). A tenant configured `en` whose user reads Chinese chrome therefore sees `Aug 2026` beside `第 1 周` — the same split `timeline.bucket.*` has always had.
