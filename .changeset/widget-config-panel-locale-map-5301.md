---
'@object-ui/plugin-dashboard': patch
'@object-ui/i18n': minor
---

`WidgetConfigPanel` reads an inline-locale-map title, and a save no longer destroys the other locales.

The dashboard widget config panel carried a private `resolveLabel` documented as
resolving an `I18nLabel` while reading `defaultValue || key` — the key-reference
form `@objectstack/spec` retired at 17.0.0-rc.6 (objectstack#5055). The inline
per-locale map `I18nLabelSchema` actually admits has neither limb, so
`{ en: 'Revenue', zh: '收入' }` resolved to `''`. It was the fourth private copy
of that resolver; objectui#4032 swept the other three out of `DashboardRenderer`,
`MetricWidget` and `MetricCard`.

This was not a display bug. The resolved value seeds the panel's editable draft,
so a widget whose stored title was a map opened with an **empty** Title field and
the next save wrote `''` over the author's map — on the ordinary path, not an
exotic one: open the widget, change anything, save.

Both halves are fixed, per the maintainer's 2026-08-20 ruling on objectui#5301:

- **Reading** goes through `pickLocalized(value, language)`, so the panel shows
  the active locale like every sibling surface post-objectui#4032.
- **Writing** replaces only the active locale's entry and carries every other
  locale across. A title the author never touched round-trips the stored object
  itself through an unrelated config edit; an edited one merges into the entry
  that was displayed. The live-update callback (`onFieldChange`) forwards the
  merged map for the same reason — hosts feed it back into the widget the panel
  re-opens from, so a bare string there dropped the map before a save ever ran.

`@object-ui/i18n` gains `setLocalized(value, language, next)`, the write-side
inverse of `pickLocalized`, so the rule is stated once instead of re-derived per
panel. It follows `pickLocalized`'s first three limbs — exact tag, base language,
region-qualified sibling — and deliberately stops there: the `default` / `en` /
first-value limbs are display fallbacks that hand back *another* locale's string,
and writing to one would let an author editing in `fr` overwrite English. With no
entry for the active locale the edit adds one. The pairing
`pickLocalized(setLocalized(map, lang, s), lang) === s` is pinned, because a
write that lands where the read does not look is how a "saved" string disappears.

A full multi-locale editing UI remains out of scope (objectui#4163).
