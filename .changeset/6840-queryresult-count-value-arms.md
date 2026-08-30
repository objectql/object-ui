---
'@object-ui/components': minor
'@object-ui/plugin-view': minor
---

Read `find()` answers as `QueryResult` declares them on two more seams: the
related-count badge store no longer reads `count`, and `ObjectView`'s non-grid
unwrap no longer reads `value` (objectui#6840, following objectui#6726).

`QueryResult` (`@object-ui/types`) declares exactly one rows member, `data`, and
exactly one count member, `total`. objectui#6726 removed the `records` arm from
seven consumers after measuring that nothing produces it at the
`DataSource.find()` seam, and deliberately left two arms reading *other*
undeclared keys standing in the same expressions — because it had measured
`records` and not them. Its own pin says so in as many words. This is the
measurement it deferred.

- `related-count-store.ts` dropped `typeof res?.count === 'number' ? res.count`,
  which was tried second and *ahead of the contract's `data`* — the same
  precedence inversion objectui#5945/#6726 were filed about, on the key those
  cards did not measure. The store already asks the server for the count with
  `$count: true` and reads it back as `total`, which is a declared member.
- `ObjectView.tsx` dropped the ladder's last branch,
  `Array.isArray((results as any).value)`. Unlike the store's arm this was a
  pure fallback, not an inversion — `data` was already read first.

Both keys are the raw-payload spellings that `ObjectStackAdapter.normalizeQueryResult`
and `ApiDataSource.normalizeQueryResult` already fold into `total` / `data`
*below* this seam, so nothing above it emits them. A producer sweep over every
`find()` definition body in the repo (452 bodies / 331 files, bracket-scanned so
a body cannot leak into sibling properties) found `count` emitted **0** times,
against controls `total` (85 hits / 75 files) and `data` (135 hits / 103 files)
drawn from the same cells. Narrowed to the 25 bodies reachable by `ObjectView`,
`value` is emitted **0** times against the same controls (6 and 6).

No producer changes behaviour, because there is no producer; what changes is
that a non-conforming one is now refused instead of silently absorbed — which
is the point (AGENTS.md #0.1). Each module gets its own refusal pin
(`*.contractEnvelope-6840.*`), and the pins keep the live arms green alongside
the deleted ones, because live and dead is the whole distinction.

Deliberately not done: `QueryResult` is **not** widened to bless `count` or
`value`. That is a published-type change and the maintainer's call, the same
floor objectui#6726 respected.

The `value` reading here is **seam-local** and does not transfer: at
`extractRecords` (`@object-ui/core`, objectui#6839) the same key is still LIVE —
five test doubles in plugin-calendar / plugin-kanban emit it today.
