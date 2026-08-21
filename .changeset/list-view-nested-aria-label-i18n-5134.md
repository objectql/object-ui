---
'@object-ui/plugin-list': patch
---

`ListView` now resolves the nested `aria.ariaLabel` against the audience's locale
instead of casting it to a string (objectui#5134).

`@objectstack/spec`'s `AriaPropsSchema` types `ariaLabel` as `I18nLabel` — a plain
string **or** an inline locale map (`{ en: 'Accounts', 'zh-CN': '客户' }`). The only
read site in this repo spread it into the DOM as
`{ 'aria-label': schema.aria.ariaLabel as string }`, and `as string` is a cast, not a
conversion: a map-valued label reached the DOM as `aria-label="[object Object]"`, which
a screen reader announces as the list view's accessible name — in every locale. The
read now goes through the spec's own `resolveI18nLabel` (the resolver four other
in-repo read sites already use) against `useDisplayLocale()`.

Reachability, stated plainly: the path is **live but unexercised**. `I18nLabel` was a
plain `string` through `@objectstack/spec` 17.0.0-rc.5, so no stored map-valued label
predates rc.6, and no measured author writes one today — but map values are legitimate
and arrive via API/import, so an imported list view carrying
`aria: { ariaLabel: { en: …, 'zh-CN': … } }` is spec-valid metadata that renders a wrong
accessible name. This is the map form working as declared, not a defect users are
currently hitting.

Behaviour on the string arm is byte-identical, including `''` (falsy before and after,
so no attribute). One edge changes for the better: a map that matches no locale used to
render `aria-label="[object Object]"` (`{}` is truthy) and now omits the attribute — an
unnamed region beats a garbage-named one.

The **flat** `schema.ariaLabel` is deliberately untouched: it carries a different
vocabulary (objectui's keyed `{ key, defaultValue?, params? }` ref, resolved by
`SchemaRenderer`'s `resolveKeyedI18nLabel`), and neither resolver accepts the other's
shape.
