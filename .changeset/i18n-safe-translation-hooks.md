---
'@object-ui/i18n': patch
---

fix(i18n): `createSafeTranslation` / `useSafeTranslate` no longer wrap the
translation hook in try/catch — the last known rules-of-hooks violation of
the class fixed in objectui#2595/#2596 (a throw after the hook ran would
desync hook order on the next render; the factory closure just escaped the
static lint). `useObjectTranslation` is provider-safe, and the actual
fallback behavior is unchanged: the testKey probe (createSafeTranslation)
and per-key `t(key) === key` detection (useSafeTranslate) still return the
English defaults when translations aren't configured. The fallback `t` is
now a stable per-factory reference, so downstream memo deps stop
invalidating every render in the no-translations case.
