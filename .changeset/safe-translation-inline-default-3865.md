---
'@object-ui/i18n': patch
---

i18n: `createSafeTranslation`'s provider-less fallback now honours a call site's inline `defaultValue`

`fallbackT` looked its key up in the hook's hand-written `defaults` map and, on a miss, rendered the
**raw key** to the user — then ran every option, `defaultValue` included, through the interpolation
loop as if it were a `{{defaultValue}}` variable. So `t('perm.facet.none', { defaultValue: 'None' })`
showed `perm.facet.none` on a host with no `I18nProvider`, which is a supported scenario (standalone
embedding and tests are the whole reason this factory exists).

The lookup order is now `defaults[key]` -> a string `defaultValue` -> the key, matching i18next,
which serves the provider path: the defaults map is the pack value's stand-in here, so it keeps the
pack's winning position. `defaultValue` is also excluded from the interpolation loop as a reserved
name — it selects the string, it does not fill holes in one. Non-string `defaultValue` is ignored.
The provider path is untouched.

Measured over all 26 `createSafeTranslation` hooks in the repo: 27 keys reach a hook whose defaults
map lacks them, 21 of those carrying an inline `defaultValue` that used to be dropped (16 keys in
`plugin-detail` alone). Those 21 now render their English instead of a raw key on provider-less
hosts; the other 6 pass no inline default and still need a map or pack entry.
