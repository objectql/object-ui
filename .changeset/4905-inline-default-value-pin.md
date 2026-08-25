---
'@object-ui/app-shell': patch
'@object-ui/plugin-detail': patch
---

Inline `t(key, { defaultValue })` strings are now held to the one placeholder spelling a
provider-less host can resolve, and five of them are pinned to the pack value for the first
time (objectui#4905).

`check:i18n-keys`' `default-value-drift` class pins an inline default byte-identical to its
`en` row, and objectui#3512 holds `en` to the one spelling `createSafeTranslation`'s
`fallbackT` interpolates — so most inline defaults were covered transitively. Re-measured
on this tree, 66 of 1003 were not: three literal defaults on dynamic keys, and 63 written
as a computed expression. A new `unresolvable-default-spelling` class in
`scripts/check-i18n-call-site-keys.mjs` now judges the text every inline default carries —
the folded sentence, or a template literal's static segments — so `{{ name }}`,
`{{count, number}}`, `{{- name}}` and `$t(key)` are refused wherever they are written,
rather than only inside a copy table.

Four call sites gain a real pin because their default carries no placeholder at all: the
record-form submit button now falls back to `Update`/`Create` (the pack's wording) instead
of `Save`/`Create` via a nested `t('common.save')`, the context selector's package label
and the approvals separator now state their literal. One more (`detail.showEmptyFields`)
is behind a `createSafeTranslation` hook, whose fallback does interpolate, so it can safely
say what the pack says.

The other 61 are deliberately left computed, and the measurement behind that is the useful
part: react-i18next's not-ready `t` returns `options.defaultValue` **verbatim, without
interpolating it**. At a call site bound to a bare `useObjectTranslation()`, a default
written as `` `Signed in as ${user.email}` `` is therefore the only form that renders
correctly with no provider — rewriting it to `'Signed in as {{email}}'` would put literal
braces in front of the user, which is the exact defect this family of cards exists to
prevent. Those sites keep their template literals and are covered by the spelling class
instead.
