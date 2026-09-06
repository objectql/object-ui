---
'@object-ui/i18n': patch
---

fix(i18n): `createI18n`'s `resources` deep-merges, so overriding one key of a namespace keeps the rest

A language pack's top-level keys ARE the namespace groups (`common`, `calendar`,
`list`, ...), each a nested object, but `createI18n` merged `resources` over the
built-in packs one level deep. Supplying a partial group therefore **replaced**
it rather than merging into it:

```ts
createI18n({ defaultLanguage: 'en', resources: { en: { calendar: { today: 'Heute' } } } });
```

left `calendar.today` set and dropped `month`, `week`, `day`, `allDay`,
`newEvent`, `moreEvents` and `unscheduled` from the instance. `t('calendar.allDay')`
then returned the bare key, and `calendar.allDay` reached the DOM as literal
text — silently, with no error and no warning.

The merge now recurses, so a partial group override touches only the keys it
names. Packs nest up to four levels below the group
(`console.ai.empty.build.title`), so it recurses rather than adding one fixed
extra level. Two in-repo call sites were affected by this and are repaired by
the change: `packages/plugin-gantt/demo` supplied 53 of the 80 `zh.gantt.*` keys
and silently lost the other 27 (its own comment says the demo "is never
half-translated" — it was), and the `skills/objectui/guides/i18n.md` setup
example, the documented way to use this API, dropped 46 of the 48 `common.*`
keys in both `en` and `zh`.

**Arrays are replaced, not concatenated** — stated because it is a decision, not
a library default. No built-in pack carries an array value today (every leaf in
all ten packs is a string), so nothing observable rides on it; the rule decides
what a future array means. An author who writes an array is naming the whole
list, so replacement is the only rule that lets them shorten or reorder one and
the only one that stays idempotent when the merge runs again. This is
deliberately narrower than i18next's own `deepExtend`, which the provider's
async `addResourceBundle` path uses: that recurses into arrays index-wise and
would leave a longer base array's tail behind, which is the same silent-hybrid
shape this fix removes.

No caller depended on the old replacement semantics: a census of every
`resources` literal in the repo (47 parsed sites, plus the dynamic ones resolved
by hand) found no site that supplied a partial group in order to clear the rest.
