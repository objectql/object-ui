---
'@object-ui/app-shell': minor
---

`asArray` in the two app-shell `find()` readers now reads exactly what
`QueryResult` declares — the `records` and `items` arms are removed
(objectui#5945).

`useApproverDirectory.ts` and `views/metadata-admin/AssignedUsersSection.tsx`
both normalised a `find()` answer with

```ts
Array.isArray(res) ? res : res?.records ?? res?.items ?? res?.data ?? [];
```

`QueryResult` (`@object-ui/types`) declares exactly one rows member — `data` —
alongside `total`, `page`, `pageSize`, `hasMore`, `cursor` and `metadata`.
`records` and `items` are not members of it, and both were tried *before* the
one that is. That is AGENTS.md #0.1 in miniature: a tolerant reader that lets a
non-conforming producer keep working, so the wrong shape is never rejected
anywhere and hardens into a second de-facto contract. The same
`records`/`items` confusion was live in three other places that objectui#5458
had to fix, each reading a key no adapter returns — a helper that quietly
accepted all three spellings is why nobody found out two of them were wrong.

**What stops being accepted.** A `find()` answer shaped `{ records: [...] }` or
`{ items: [...] }` now reads as **no rows** at these two seams instead of
silently resolving. Both call sites degrade rather than throw: the approver
directory reports the reference unresolved (falling back to the prettified
machine name, and staffing as probed-empty), and the assigned-users section
renders its empty state.

**Nothing produces those shapes today**, which is why this is a removal rather
than a migration. Measured across the repo, per arm:

- **`records`** — no producer at the `DataSource.find()` seam.
  `ObjectStackAdapter.normalizeQueryResult` maps the server's `records`/`value`
  envelope to `data` before returning, so the spelling exists only *below* the
  adapter, on the wire and in the client SDK. The two remaining `records`
  producers in the repo are on different seams: `ViewDataProvider` returns its
  own `ResolvedData` interface, which declares `records` legitimately, and is
  not a `QueryResult`.
- **`items`** — no producer at any seam. Every `items` in the repo is the
  unrelated UI-schema key (dropdown menus, timeline, accordion).

**The bare-array arm is kept**, because it is live: fakes at these seams answer
with a plain array (`AssignedUsersSection.test.tsx` is one). It is pinned in the
same tests as the deletions, so the live and the dead shapes cannot drift into
each other.
