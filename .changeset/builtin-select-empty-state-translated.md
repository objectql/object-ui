---
"@object-ui/components": patch
---

The form renderer's built-in `select` branch stops saying "No options available"
in English to non-English sessions (objectui#3263).

FROM: the inline branch that renders a `type: 'select'` field — the one taken
whenever the field is a `BUILTIN_FIELD_TYPES` member, i.e. before the `field:`
registry is consulted — rendered `{emptyHint || 'No options available'}`. TO:
`{emptyHint || t('fields.options.empty')}`, the same i18n key the registered
option widgets fall back to (objectui#3231, all ten locale packs).

This was the last hardcoded copy of that sentence in `form.tsx`, and the file was
half-translated in a way a user could see inside one widget: the dependency-gate
sentence next to it already went through `t()`
(`fields.options.selectFirst`), so under a `zh` session a gated select read
"请先选择Country" and the same select — one keystroke later, when the parent
value matched no option — flipped to English.

`fields.options.empty` is added to `useSafeFormTranslation`'s defaults map, the
pattern `fields.options.selectFirst` already follows there, so a form rendered
with no `I18nProvider` (standalone widget, test, embedded form) produces the
byte-identical English string it produced before. Both halves are pinned by
tests: the Chinese rendering in one file, the no-provider English fallback in
another (mounting a provider installs it as react-i18next's global default,
which would erase the state the second one observes).

The box moved from an inline `<div>` into a small `BuiltinSelectEmptyState`
component in the same file, because `renderFieldComponent` is a plain helper that
early-returns on the registered-widget path — a hook called there would run
conditionally. It forwards its rest props, since `<FormControl>` is a Radix
`Slot` that supplies the control's `id` / `aria-describedby`; a test pins that
the field's `<label for>` still resolves to this box.

Deliberately NOT unified with `@object-ui/fields`' `OptionsEmptyState`: different
package, different render path (inline branch vs. registry). What the two share
is the i18n key, not a component — merging them would impose one path's markup
and props on the other.
