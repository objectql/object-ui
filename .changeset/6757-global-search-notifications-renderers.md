---
'@object-ui/app-shell': minor
---

Renderers for the `global:search` and `global:notifications` page blocks
(objectui#6757). A page that declared either member drew the literal "Component
Placeholder" scaffold: both are first-class `PageComponentType` members that the
2026-08-26 maintainer ruling on objectstack#12183 kept declared once the
readiness read in objectstack#13117 evidenced both data sources shipped, and
the renderer was the remaining half.

Neither block adds a data layer — each is a new mount point on plumbing that was
already live:

- `global:search` mounts `useRecordSearch` (`@object-ui/react`), the same hook
  the ⌘K command palette and the full-page search results already use. It
  prefers the adapter's `searchAll` (`GET /api/v1/search` — cross-object hits
  with title/snippet/record) and inherits that hook's fanout fallback for
  adapters without it. Scope is the metadata provider's searchable object set,
  which is the hook's documented default when no `objectNames` whitelist is
  given.
- `global:notifications` mounts `InboxPopover` — the bell ADR-0012/ADR-0030
  defines ("the bell reads `sys_inbox_message`") — over the shared inbox feed.

To keep that second one honest, the header bell's inbox wiring (rows, badge
addends, and the three mark-read paths) moves out of `AppHeader` into a new
`useInboxBell` hook that both surfaces mount. Copying it would have re-opened
the two defects `sharedUserFeeds` closed — #4225 (two owners of one read issuing
it twice per page) and #4316 (two derivations of read-state disagreeing) — so a
bell in the header and a bell an author declared on a page now have no
representable state in which they disagree about a row.

Both registrations publish **no** `inputs`: `ComponentPropsMap` declares an
empty shape for each ("declares no props at all" is the recorded intent), and
both use `skipFallback: true` so neither claims the bare `search` /
`notifications` keys. This does not change the Studio page palette —
`global:notifications` remains recorded there as a shell singleton, which is a
palette decision independent of whether a declared type renders.
