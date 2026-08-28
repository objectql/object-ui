---
'@object-ui/plugin-map': patch
'@object-ui/plugin-tree': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-gantt': patch
---

Re-key the load-bearing fetch effects in `ObjectMap`, `ObjectTree`,
`ObjectCalendar` and `ObjectGantt` onto the primitive fields they actually
read off `dataConfig` (`provider` / `object` / `items`) instead of the whole
memoised `dataConfig` object (objectui#6592, the deferred half of
objectui#6270/PR #6591).

`useMemo` carries no semantic guarantee — React is permitted to discard a
memo cache and recompute even when its dependency array compares equal to
the previous render, and the local `getDataConfig(schema)` helper each of
these renderers carries builds a fresh `{ provider, object }` /
`{ provider, items }` wrapper object on every call. So a fetch effect keyed
on `dataConfig` itself was correct only for as long as that identity
happened to survive a discard: a recompute alone (no author or caller
action) was enough to re-run the effect and issue an extra
`dataSource.find` / `dataSource.getObjectSchema` call. Keying the effects
on the primitives instead makes a cache discard a no-op, restoring
`useMemo` to a pure optimisation.

`ObjectGantt`'s `effectiveDataSource` memo deliberately keeps `dataConfig`
as a dependency (`resolveDataSource` needs the whole provider-shaped
value — the `api` provider's `read`/`write` request config cannot be
flattened to a fixed primitive list the way `object`/`value` can), so its
`reload()` fetch is decoupled from the redundant direct `dataConfig`
dependency but not from `effectiveDataSource`'s own; for the `object`/`value`
providers `resolveDataSource` returns its `fallback`/a fresh
`ValueDataSource` respectively rather than reading further into the config,
which is enough for the two fetch effects to observe no extra call under a
recomputed-but-equivalent `dataConfig` in the common case.

No behaviour change for a schema whose `useMemo` caches survive normally;
the effects are unaffected by React discarding one.
