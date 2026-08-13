---
'@object-ui/auth': minor
---

The data lane now honors `set-auth-token`, so impersonation takes effect at all (#4467).

The console injects the same localStorage bearer from two lanes: the AUTH lane
(`createBearerFetch` inside `createAuthClient`) and the DATA lane
(`createAuthenticatedFetch` — the adapter, `provider: 'api'` data sources, and every
metadata `type: 'api'` action). better-auth's server-side bearer plugin hands a ROTATED
session token back in the `set-auth-token` response header on whichever lane the call
arrived over, and only the auth lane read it. A rotation issued to a data-lane call was
discarded and the browser kept sending the old token.

`POST /auth/admin/impersonate-user` is exactly such a call — an ordinary metadata action.
The impersonated session token was dropped on the floor while the server's bearer plugin
kept overwriting the impersonation cookie with the admin bearer the console kept sending,
so impersonation was a complete no-op in the console rather than merely an invisible one.
Support staff believed they were seeing a user's view while acting entirely as themselves.

Published behaviour that moves: a data-lane response carrying `set-auth-token` now
replaces the stored session token, on any API call this lane authenticated (untrusted
targets remain the `sameOriginOnly` option's job — it short-circuits before any header
work). The accepted cost, recorded on the card: while impersonating, the administrator's
own token is replaced in localStorage for the duration, and a client that misses the stop
rotation is stranded until re-login.

Also in this release, all additive:

- `AuthContextValue.refreshSession()` re-resolves `user`/`session` from the server in
  place, without raising `isLoading` — the transitions that change WHO the session is
  without going through `signIn`/`signOut`.
- `TokenStorage.subscribeRotation()` notifies when a token already in hand is replaced by
  a different one. First store, `clear()`, and re-storing the same value stay silent:
  those transitions have an owner that updates identity itself.
- `AuthClientSession.impersonatedBy?: string` — optional, set by better-auth's admin
  plugin for the life of an impersonated session.
