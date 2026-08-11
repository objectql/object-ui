---
'@object-ui/i18n': minor
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

The console's language menu now asks the app which locales it actually ships, instead of always offering the same ten.

`LocaleSwitcher` built its items from a module-level `LANGUAGES` constant — exactly the ten codes `@object-ui/i18n` ships packs for — and never consulted the app, even though `GET /api/v1/i18n/locales` has been serving that list all along. It failed in both directions at once. An app shipping a locale outside those ten (`th`, a regional `pt-BR`) had no way to be selected from the console: the bundle could be complete and lint clean, and the menu simply had no entry for it. An app shipping only `en` and `zh` still listed all ten, so picking 日本語 handed the user the console's own chrome in Japanese with everything app-authored in the fallback language — a half-translated UI its author never opted into.

The menu is now the **intersection**: the app's own locale list ∩ what the renderer can actually resolve (built-in packs, `config.resources`, and — for an app that wires a dynamic `loadLanguage` loader, which is how the console gets its packs — the locales that loader can fetch). Both failure directions close in the same change: an app-shipped locale becomes offerable, and locales the app does not ship disappear. The endpoint is reached through a new `loadLocales` prop on `I18nProvider`, wired exactly like the existing `loadLanguage`: the app owns the transport, the provider owns what is done with the answer. An app that does not wire it keeps today's menu unchanged.

**The restore validation widened in lockstep, because otherwise this fix would have minted the next bug.** A restored language was validated against "the locales this provider can produce" — built-in packs plus `config.resources` — a bound that was correct only for as long as the menu offered exactly the built-in ten. The moment the menu grows to the app's real list, a locale the user can now pick is a locale that bound rejects, so a user-picked app locale would have been purged on the next page load. It now also accepts a locale a wired dynamic loader may be able to fetch, and the bound stays honest rather than absent: only well-formed BCP-47 tags qualify (`constructor`, `__proto__`, `en_US` are still rejected, as is any stored locale in an app with no loader), and the app's own locale list adjudicates the choice for real once it arrives — a locale the app has since dropped is reverted and purged rather than left locking the UI to a language with no translations.

Labels come from the built-in native names where they exist (`中文`, `日本語`, … are unchanged) and from `Intl.DisplayNames` for everything else, so an app locale is named in its own language rather than by its code. The endpoint's own `label` is deliberately not used for display: the server sets it to the code echoed back, which would have put `th` in the menu where `ไทย` belongs.

While the app's list is in flight the switcher renders nothing, following the sibling menus in the same folder — the ten never flash past on an app that only ships two. When there is no backend, the endpoint fails, or the app answers with nothing this renderer can produce, the built-in ten remain as the offline fallback, so the menu is never empty and never unusable.
