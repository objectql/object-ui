---
"@object-ui/auth": patch
---

getSession self-heals a stale localStorage bearer: an invalid `auth-session-token` used to SHADOW a perfectly valid cookie session — SSO landings (e.g. the cloud console's sso-exchange into a tenant environment) only set the cookie and cannot touch the target origin's localStorage, so users with a leftover token bounced back to the login page forever. On a bearer get-session miss the client now retries once cookie-only: a live cookie session wins (its token replaces the stale one); an affirmative double-miss drops the dead token; transport errors keep it. getSession also no longer throws on network errors (better-fetch rethrows them).
