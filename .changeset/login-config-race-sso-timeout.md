---
'@object-ui/auth': patch
---

Login-page auth-config hardening (#2625, #2626):

- `createAuthClient.getConfig` now single-flights + caches the `/auth/config`
  fetch (the login page's three consumers used to fire three requests) and
  retries failures with backoff (500ms/1.5s/3.5s, 8s per-attempt abort) before
  rejecting. A cold-starting environment kernel no longer strands the page
  without its SSO buttons; a final failure clears the cache so later callers
  retry.
- `LoginForm` holds a spinner instead of painting the password-form defaults
  while config resolves — an SSO-only deployment must never flash a password
  wall at JIT users who have no password. A failed config still falls back to
  the password form (break-glass beats lock-out).
- `signInWithProvider` gains a 20s watchdog: a sign-in request that hangs now
  rejects with a clear timeout error so the provider button recovers instead
  of spinning forever.
- Removed LoginForm's duplicate "or" divider — SocialSignInButtons already
  renders its own, and the stacked pair read as a rendering glitch.
