---
'@object-ui/auth': patch
'@object-ui/app-shell': patch
---

Sign-out now drops the client-side caches that belonged to the session it ends,
and the metadata seed cache is keyed by session identity.

`sessionStorage` is per-tab, not per-session, and no sign-out call site reloads
the page — so the `objectui:metadata:*` entries (the app list the server
permission-filters per session) and the active-organization id survived into
whatever happened next in that tab. A second person signing in on a shared,
kiosk or handover browser was seeded with the previous user's filtered app list.
Organization scoping did not close this: two users in the same organization
computed the same cache key.

`AuthProvider.signOut()` now purges the `objectui:metadata:` entries and clears
`ActiveOrganizationStorage` (and the in-memory organization block) on both the
success and failure paths, and `MetadataProvider` keys each entry by a
fingerprint of the session token, so an entry that escapes the purge is
unreadable by the next principal rather than merely undeleted. Entries left by
another principal are deleted the first time a console mounts.
