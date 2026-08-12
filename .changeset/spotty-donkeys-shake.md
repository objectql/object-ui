---
'@object-ui/data-objectstack': patch
'@object-ui/plugin-list': patch
'@object-ui/i18n': patch
---

fix(list): an `OBJECT_API_DISABLED` list request renders an honest cannot-work state instead of the empty state

A list pointed at an object whose `enable` block withholds the API rendered its ordinary
empty state, so *"this page cannot work, and never could"* reached the user as *"you have no
records"* (objectui#4408). The reported instance — `Setup › Advanced › Signing Keys`, whose
`sys_jwks` declares `enable.apiEnabled: false` — could not load for any persona and said so
to nobody. That is also why the upstream defect objectstack#7544 survived review for its
whole life: a merely unpopulated page invites nobody to click through.

The masking had two halves, in two packages, and neither package could see the other:

- **`@object-ui/data-objectstack`** — `find()` degraded **every** 404 into
  `{ data: [], total: 0 }` and memoised the resource, so the denial arrived at the surface as
  a successful empty result, indistinguishable from a genuinely empty object. The two
  `enable`-block denials are now let through instead: `OBJECT_API_DISABLED` (404) and
  `OBJECT_API_METHOD_NOT_ALLOWED` (405). The memo skips them too — absorbing one would have
  pinned the object to "empty" for the rest of the session. New exports:
  `isApiAccessDeniedError(error)` and `API_ACCESS_DENIED_CODES`.
- **`@object-ui/plugin-list`** — the load-error panel gained an `api-disabled` kind. The 405
  half was never swallowed, so it already reached this panel, but classified as `network`:
  *"check your connection and try again"* for a condition no retry can change. It now says
  the object is not exposed through the API, that this is a setting on the object rather than
  a permission, and it offers **no Retry** button, because every retry re-fetches the
  identical refusal.

Both denials are pure functions of the object's metadata — no user, no permission, no
context — so neither is transient or per-user, which is exactly the case where a silent empty
state is most misleading. Discrimination is on the ADR-0112 `code`, never the status: a
missing collection, a missing record and a disabled object are all 404.

**A genuinely empty object still renders the ordinary empty state**, and a backend without an
optional collection still degrades to empty — pinned in both directions, at the adapter, at
the view, and once end-to-end over a real adapter and a real `ListView`.

Also closes a code-propagation gap on the same path: `find()`'s raw `$expand`/`$search`
branch bypasses `@objectstack/client` and hand-rolled its own error, stamping only `status`.
It now carries the ADR-0112 envelope (`code` + `httpStatus`), so a denial arriving on the
branch a list takes whenever it expands a lookup or runs a search is no longer anonymous.

New strings: `list.loadErrorApiDisabledTitle` / `list.loadErrorApiDisabledMessage`, in the
`en` pack and mirrored in the list defaults map.
