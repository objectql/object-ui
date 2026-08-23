---
'@object-ui/app-shell': patch
---

**Behaviour change:** the console action runtime (`useConsoleActionRuntime`) now
builds its authenticated fetch with `sameOriginOnly: true`, matching the
`provider: 'api'` data-source lane (`ConsoleShell`). A metadata `type: 'api'`
action whose resolved target is a different origin than the page is fetched
through the bare global fetch: the platform Bearer token, `X-Tenant-ID`, and
`Accept-Language` are no longer attached (objectui#5702, maintainer ruling
2026-08-22). Previously the Bearer rode to any off-origin target whose URL
contained `/api/`, and `X-Tenant-ID` rode to every off-origin target
unconditionally.

Same-origin actions — including every relative target in a same-origin
deployment — are unchanged, and off-origin requests still execute (pass-through,
not a refusal). An off-origin integration that legitimately needs the platform
bearer declares itself explicitly or proxies same-origin.

Note for split-host setups: `apiHandler` prefixes relative action targets with
`VITE_SERVER_URL`. When that is set to an origin different from the page's
(e.g. a standalone Vite dev server pointing at a remote ObjectStack server),
those action requests are off-origin and no longer carry credentials.
