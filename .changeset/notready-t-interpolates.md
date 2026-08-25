---
'@object-ui/i18n': patch
---

fix(i18n): `useObjectTranslation`'s provider-less `t` now interpolates its inline `defaultValue`

With no `I18nProvider` mounted, react-i18next hands back its not-ready `t`, which
returns `options.defaultValue` **verbatim** — so an inline default written
`'Deleted {{count}} rows'` reached the user with the braces intact. 68 inline
defaults across 24 files rendered through that path on any host that embeds an
ObjectUI component without a provider, which is the configuration
`createSafeTranslation` exists for.

`useObjectTranslation` now runs its not-ready result through the same one
interpolator `createSafeTranslation`'s `fallbackT` uses, so both provider-less
renderers fill exactly the `{{name}}` spelling the copy is already gated to. The
ready path is untouched: with a provider, i18next's own `t` is returned by
reference and nothing is interpolated twice. Pre-interpolated template-literal
defaults (`` `Deleted ${n} rows` ``) stay correct — they have no holes left to
fill — so no call site changes.
