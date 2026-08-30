---
'@object-ui/plugin-tree': patch
---

Re-key `ObjectTree`'s record-fetch effect onto the primitive fields it
actually reads off `dataConfig` (`provider` / `object` / `items`) instead of
the whole memoised `dataConfig` object (objectui#6700, closing out the
census #6592 opened — the schema-resolution half of this component was
already re-keyed onto `useSettledSchema`'s primitive `schemaKey` by #6696).

`useMemo` carries no semantic guarantee — React is permitted to discard a
memo cache and recompute even when its dependency array compares equal to
the previous render, and the local `getDataConfig(schema)` helper builds a
fresh `{ provider, object }` / `{ provider, items }` wrapper object on every
call. So the record-fetch effect, keyed on `dataConfig` itself, was correct
only for as long as that identity happened to survive a discard: a
recompute alone (no author or caller action) was enough to re-run the
effect and issue an extra `dataSource.find` call. Keying the effect on the
primitives instead makes a cache discard a no-op, restoring `useMemo` to a
pure optimisation — mirroring the fix already shipped for `ObjectMap` /
`ObjectCalendar` / `ObjectGantt`.

No behaviour change for a schema whose `useMemo` caches survive normally;
the effect is unaffected by React discarding one.
