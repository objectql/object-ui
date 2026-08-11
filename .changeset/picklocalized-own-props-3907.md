---
'@object-ui/i18n': patch
---

`pickLocalized` reads own properties only, and takes only string values, on every limb

The resolver read four of its six limbs — the exact tag, the base language, `default` and `en` — with a bare bracket access. Bare access walks the prototype chain, so a locale that happened to name an `Object.prototype` member resolved to that member and the function stringified it into the label: `pickLocalized({ en: 'Pricing' }, 'constructor')` returned `function Object() { [native code] }`, and the same held for `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable` and `toLocaleString`. Those same four limbs also skipped the `typeof === 'string'` filter the regional and last-resort limbs already applied, so a non-string value short-circuited the chain and rendered as `[object Object]`.

Both guards now apply uniformly. A guarded limb **misses** rather than aborting the resolution, so an unusable entry falls through to the next limb exactly as an absent one does — `pickLocalized({ en: 'Pricing' }, 'constructor')` is now `'Pricing'` (the `en` limb), and only a map with no usable entry at all resolves to `''`. An empty-string value is still a hit, because `''` is a label the author wrote.

No real language tag can observe this: no BCP-47 tag is an `Object.prototype` member, and the inline locale map is declared `z.record(<tag>, z.string())`, so every in-contract input resolves byte-identically to before. What it changes is agreement with the backend twin `resolveI18nLabel` (objectstack#6765), which shipped with exactly these two narrowings recorded as deliberate departures from this function because on a server the locale can arrive in an `Accept-Language` header. That recorded rule divergence is now zero; the only remaining difference is how each side spells a miss (`''` here for a text node, `undefined` there for a producer's fallback chain), which is pinned as an identity in the cross-resolver parity table.
