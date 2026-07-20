---
"@object-ui/react": minor
"@object-ui/auth": minor
"@object-ui/app-shell": patch
"@object-ui/plugin-gantt": patch
---

feat(data): thread the host's authenticated fetch into `provider: 'api'` data sources (#2725)

`provider: 'api'` view data sources went through a bare `globalThis.fetch`, so
custom endpoints (gantt composite trees, report aggregates) carried only
same-origin cookies while every native `/api/v1/*` request carried
`Authorization: Bearer` — the moment cookie HMAC verification failed (dev
restart rotating the fallback auth secret, cookie expiry/rotation in prod)
those views 401'd while the rest of the app kept working.

- **`@object-ui/react`** — `SchemaRendererProvider` accepts an optional
  `apiFetch`; nested providers inherit it from their parent so re-wrapped
  subtrees (react pages, preview surfaces) keep the host's authentication.
  `useViewData` defaults the api-provider adapter's fetch to the context
  `apiFetch` (explicit `adapterOptions.fetch` still wins).
- **`@object-ui/auth`** — `createAuthenticatedFetch` gains a
  `sameOriginOnly` option: cross-origin URLs pass through to the bare fetch
  with no `Authorization` / `X-Tenant-ID` / `Accept-Language`, so metadata-
  supplied third-party URLs never see the platform token.
- **`@object-ui/app-shell`** — the console wires
  `createAuthenticatedFetch({ sameOriginOnly: true })` (settle-signal wrapped)
  as `apiFetch` on the root `SchemaRendererProvider`.
- **`@object-ui/plugin-gantt`** — `ObjectGantt` resolves its api-provider
  DataSource with the context `apiFetch`, covering reads and write-backs.

Behaviour is unchanged for hosts that don't provide `apiFetch` (bare fetch +
cookies, as before).
