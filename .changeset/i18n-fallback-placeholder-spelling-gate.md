---
---

Test-only (objectui#3512). Every copy source the provider-less translation fallback can be
asked to render is now held to the one placeholder spelling that fallback resolves, pinned by
`packages/i18n/src/__tests__/fallback-placeholder-spelling-3512.test.ts`.

`createSafeTranslation`'s `fallbackT` interpolates with an exact literal needle, so it
recognises `{{name}}` and nothing else, while i18next — serving the same strings whenever an
`I18nProvider` is mounted — also recognises `{{ name }}`, `{{count, number}}`, `{{- name}}`
and `$t(nested)`. Copy written in any of those four renders correctly through a provider and
leaks literal braces without one, silently, on exactly the standalone and embedded hosts we
never look at. Per the maintainer's objectui#4135 ruling the answer is the spelling contract,
not a second interpolator chasing i18next's dialects: `{{x}}` is i18next-bound copy, `{x}` is
a hole filled downstream of `t()`.

The gate reads only string VALUES reached through a copy table's own data structure — the ten
locale packs, the 31 `createSafeTranslation` defaults tables (discovered from the factory's
first argument, so a new table is covered the day it is written) and the three hand-rolled
sibling tables that re-implement the same needle. Single-brace holes and JSX object literals
(`style={{ … }}`, `context={{ org }}`) are therefore out of range by construction rather than
by an allow-list that could rot. Zero violations on this tree, which is why the gate lands
green: it makes a dormant divergence unreachable by construction instead of by luck.

No published behaviour changes — no package's runtime source was touched, `useSafeTranslation.ts`
least of all.
