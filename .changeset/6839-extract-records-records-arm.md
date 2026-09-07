---
'@object-ui/core': minor
---

`extractRecords` reads a `find()` answer as `QueryResult` declares it: the
`records` arm is gone (objectui#6839, following objectui#5945 / #6726 / #6840).

`QueryResult` (`@object-ui/types`) declares exactly one rows member, `data`.
This shared normaliser's ladder was `array -> records -> data -> value`, i.e.
the undeclared spelling AHEAD of the contract's own member — the same
precedence inversion objectui#5945 was filed about and objectui#6726 repaired by
hand at seven other seams. The ladder is now `array -> data -> value`.

`records` is the below-the-adapter spelling: `ObjectStackAdapter
.normalizeQueryResult` and `ApiDataSource.normalizeQueryResult` (its
`['data','items','results','records','value']` envelope loop) both CONSUME the
server/SDK `records` envelope and return `data` before an answer reaches this
helper, and every consumer calls it strictly above that fold. So no producer
changes behaviour, because there is no producer; what changes is that a
non-conforming one is refused instead of silently absorbed — and, being first,
the arm used to outrank `data` when a producer emitted both.

Reach, re-derived on this tree rather than taken from the card (which was
measured six days before filing and is stale in three places): ten call sites in
nine packages. Seven call `extractRecords` directly — `ObjectChart` (x2: the
chart rows, and the group-by lookup label domain inside the exported
`resolveGroupByLabels`), `ObjectDataTable`, `ObjectPivotTable`, `ObjectGantt`
(the quick-filter option domain), `ObjectKanban`, `ObjectTimeline`. Four more
reach it through `applyNonGridRowCeiling` (`@object-ui/react`), which is itself
a published export and a sink in its own right: `ObjectCalendar`, `ObjectGantt`
(its rows), `ObjectMap`, `ObjectTree`.

Producer measurement, per consumer rather than once for all of them: no `find()`
in any of those nine packages, nor in the apps and examples that mount them,
emits a `records` envelope. CONTROL, so the zero is a reading rather than a
miss — the same sweep finds `records` envelopes elsewhere: `ViewDataProvider`'s
own `ResolvedData` (served by that module's own private reader of the same
name), the raw Cloud HTTP payloads, the client-SDK doubles below
`normalizeQueryResult`, the record-visibility batch route stubs, and one live
`find()` double at `plugin-list`'s ObjectGallery — a consumer with its OWN
unwrap ladder, which does not come through here and is untouched.

The `value` arm STAYS. objectui#6840 removed `value` from `ObjectView`'s ladder
on a measured zero at that seam and stated that its zero must not transfer here;
it does not. Five `find()` doubles emit `{ value: [...] }` into this helper
today (three in `plugin-kanban`, two in `plugin-calendar`), so the arm is live
and its removal is a separate card with its own measurement.

`QueryResult` is NOT widened to bless `records` — that is a published-type
change and the maintainer's call, the same floor objectui#6726 and #6840
respected.

One refusal pin per module (`*.contractEnvelope-6839.*`), each keeping the live
arms green alongside the deleted one, because live and dead is the whole
distinction — plus a direct pin on the helper for the precedence question a
per-module render pin cannot ask ("when BOTH keys are present, which wins").
