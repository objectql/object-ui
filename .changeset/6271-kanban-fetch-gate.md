---
'@object-ui/plugin-kanban': patch
---

`ObjectKanban` no longer queries twice on mount (objectui#6271). A standalone board issued
its first `find` before the object definition resolved — so `buildExpandFields` saw no
fields and that query carried no `$expand` at all — then issued a second, expanded one once
the definition landed:

```
['deal', { $top: 100 }]
['deal', { $top: 100, $expand: ['owner'] }]
```

The definition now GATES the query instead of refining it afterwards: one query per mount,
carrying the expansion the first time.

Decided on measurement rather than on the two shapes' relative appeal. The first response
never reached the screen in the regimes that matter: with the schema resolving no slower
than the row query (profiles schema/find = 30/30, 30/60, 5/30 ms), the definition lands
first, the effect re-runs, its cleanup flips `isMounted` false, and the unexpanded rows are
discarded on arrival — a DOM probe polling every 2ms for a title only that response carried
never fired once. What the gate costs is one schema resolution ahead of the query, and that
read is cheap and shared: one small GET behind the same discovery call `find` already
awaits, served thereafter from `MetadataCache` (5-minute TTL, concurrent readers coalesced
onto one request). Measured against the real `ObjectStackAdapter` over loopback HTTP, 22
reads of one object produced exactly one metadata request and every read after the first
returned in 0.01ms. End to end the board is not slower for it — same harness, before →
after, time to the fully populated board: 156.9 → 145.2ms (30/30), 119.8 → 110.6ms (30/60),
54.7 → 52.4ms (5/30).

The gate is on the definition read having **settled**, not on the definition being truthy:
an adapter that exposes no `getObjectSchema`, and a read that throws, both settle with
nothing to report and the board falls through to an unexpanded query rather than waiting
forever. Boards fed rows by a parent (`data`, `bind`, inline `schema.data`) are untouched —
they never ran this effect, and they still read the definition for lane titles and labels.

The `isOpaqueId` suppression in the card-description path is unchanged and keeps its
comment beside it: part of what it hid was this fetch ordering, but unexpanded rows still
reach it from parents that pass rows they fetched without `$expand`, from author-supplied
data, and from backends that decline an expansion.
