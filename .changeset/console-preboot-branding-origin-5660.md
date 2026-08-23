---
'@object-ui/console': patch
---

The console's pre-boot branding script now resolves its server origin from
`VITE_SERVER_URL` — the same variable every module-side consumer reads — instead of
`window.__CONSOLE_SERVER_URL`, a global nothing in this repository ever set
(objectui#5660).

The two callers of `GET /api/v1/runtime/config` share one in-flight request, and
that sharing keys on the FULL URL. So the origin was half of the contract: the
inline script in `index.html` read one spelling and `src/main.tsx` read another, and
whenever they disagreed the two never found each other. A same-origin production
build hid it completely — both spellings collapse to `''` — so the split surfaced
only in a dev pointing the console at a separate server, where it cost two requests
to two different servers and let pre-boot branding paint from the wrong one.

The pre-boot fetch is kept, not deleted: it is the request the module side JOINS.
`sharedGetJson()` can only hand an earlier request to a later caller, and this
script is the earlier one by construction — it runs during HTML parse, before the
bundle is fetched, while `initRuntimeConfig()` is awaited before
`createRoot().render()`. Deleting it would not remove a request; it would move the
single remaining one later, onto the critical path to first paint, and leave the
page's empty `<title>` and favicon unbranded until React mounts.

Vite substitutes its HTML env token only when the variable is set and leaves it
verbatim otherwise, so the unset case is read as same-origin `''` rather than
allowed to reach the URL as a path segment.
