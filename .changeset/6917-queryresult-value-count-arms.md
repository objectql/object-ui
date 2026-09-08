---
'@object-ui/fields': minor
'@object-ui/plugin-detail': minor
'@object-ui/plugin-list': minor
'@object-ui/app-shell': minor
'@object-ui/console': minor
---

Read `count` / `value` answers as the contract declares them at six more seams
(objectui#6917, following objectui#5945 / #6726 / #6840 / #6839).

**One precedence inversion, repaired without deleting the arm.**
`@object-ui/fields`' lookup chip resolved fetch-on-demand rows with
`result?.value || result?.data || []` — `value` AHEAD of `data`, the one rows
member `QueryResult` (`@object-ui/types`) declares. A producer emitting both was
resolved to the undeclared key. It now reads through `@object-ui/core`'s
`extractRecords`, whose accepted set is identical (bare array, `data`, `value`)
and whose order is the contract's. The `value` arm is **kept**: its own producer
census measured eight live `find()` doubles emitting `{ value: [...] }` at this
seam (3 plugin-kanban, 3 plugin-calendar, 2 plugin-grid), so deleting it would
break them. Only the RANK was wrong.

**Five dead arms deleted, each on its own measured zero.** Every module got its
own census with the control sitting on the producer→consumer join, because
objectui#6840's zero is seam-local and is not transferable — the same sweep read
0 producers for `value` at one seam and 5 at another in a single pass.

- `count` at the `DataSource.find()` seam — `plugin-detail`'s reference rail and
  `plugin-list`'s ListView. 0 of 592 `find()` producers emit `count`; controls
  `data` (312) and `total` (150) lit on the same pass. Both adapters'
  `normalizeQueryResult` already fold `count` into `total` below every consumer.
- `value` at the `client.meta.getItems()` seam — `app-shell`'s help menu and the
  console's Public Forms and Flow Runs pages. **These three do not sit on the
  `DataSource.find()` seam at all**, so they were measured on their own join: 0
  of 28 `meta.getItems` producers emit `value`; control `items` (18) lit. The
  canonical readers of that envelope (`MetadataProvider.extractItems`,
  `MetadataService.getItems`) have never had a `value` arm either.

No producer changes behaviour, because at these five sites there is no producer;
what changes is that a non-conforming one is refused rather than silently
absorbed (AGENTS.md #0.1).

`QueryResult` is **not** widened to bless `count` or `value` — a published-type
change and the maintainer's call, the floor objectui#6726, #6840 and #6839 all
held. A producer that really speaks either belongs behind an adapter that folds
it, which is what both adapters already do.

One refusal pin per module, each keeping the live arms green beside the deleted
one, and — where an inversion actually existed — a case feeding both members with
different contents, the only input that can tell the two orders apart.

Also repaired: two `plugin-grid` test doubles answered `{ value: [],
'@odata.count': 0 }` while `ObjectGrid` reads `result.data` / `result.total`.
Inert only while the arrays were empty; the first row put in one would have been
silently dropped. Test-only.
