---
"@object-ui/app-shell": patch
---

fix(metadata-admin): authenticate console MetadataClient requests (Bearer token)

Studio / metadata-admin surfaces issued `/api/v1/meta/*` requests (list types,
`?package=…` reads, `_drafts`, the `/meta` root) that came back `401
unauthenticated` in the token-based console, while the runtime data adapter's
reads (`/meta/object|view|app`) succeeded — so the same page showed some
metadata requests failing and others working.

Root cause: `useMetadataClient` and `MetadataProvider`'s draft-preview client
constructed `MetadataClient` without a `fetch`, so it fell back to the bare
`globalThis.fetch` and sent no `Authorization` header. The console
authenticates by a Bearer token in localStorage (`auth-session-token`) — there
is no session cookie — so those requests were unauthenticated. A same-origin
cookie deployment masks the bug, which is why it went unnoticed and regressed
twice.

Both sites (and every future console surface) now construct through a single
`createConsoleMetadataClient` factory that bakes in `createAuthenticatedFetch`
(Bearer token + `X-Tenant-ID` + `Accept-Language`), matching the runtime data
adapter. This is additive for cookie deployments — `credentials` is untouched,
so a same-origin session cookie still flows. A
`metadata-client-auth.ratchet.test.ts` guard forbids a bare
`new MetadataClient(` elsewhere in app-shell so authentication can't silently
regress again.
