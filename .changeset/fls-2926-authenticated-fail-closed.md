---
'@object-ui/permissions': minor
'@object-ui/console': patch
---

fix(permissions): close the console FLS fail-open for token-only sessions (framework#2926 ④). Two halves: `MePermissionsProvider` gains a `fetcher` prop and the console passes `createAuthenticatedFetch()` so `/me/permissions` carries the Bearer token like every other data call (the cookie-only default fetch resolved token-only sessions as anonymous); and the unknown-object default is now authentication-gated — authenticated sessions fail CLOSED when an object has no resolved perms (fields render read-only instead of inviting input the data layer strips), while anonymous sessions keep the permissive default so guest/public forms keep working. Pairing note: with an older framework whose `/me/permissions` returns sparse objects for authenticated users, unconfigured objects now render read-only.
