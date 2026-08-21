---
'@object-ui/plugin-map': patch
---

`ObjectMap` reads `schema.data` in one place again, so an array-shorthand map stops
making a metadata request it never uses.

The fetch effect carried a second short-circuit beside the `props.data` one
objectui#5003 fixed: it read `schema.data` directly and tested whether that value was
itself an array. eslint reported it as `missing dependency: schema.data` — the last
`react-hooks/exhaustive-deps` warning on that effect.

The dependency was never actually missing. `getDataConfig(schema)` already returns
`schema.data` verbatim, and the result is memoized on `JSON.stringify(rawDataConfig)`
into `dataConfig`, which **is** one of the effect's declared dependencies. The authored
rows therefore reached the effect before this change; the direct read was a duplicate of
an already-threaded value, which is why neither adding a dependency nor deleting the
branch was right.

The array handling moved into `getDataConfig`, where `ObjectGrid`'s own `getDataConfig`
already pins the same normalization (`"Check if data is an array (shorthand format)"`).
Same rows render, and the effect now reads only `dataConfig`.

One behavioural consequence, and it is the point: an array under `data` now yields
`provider: 'value'`, so `hasInlineData` is true and the sibling effect no longer calls
`dataSource.getObjectSchema()` for it. That request's only read site is
`buildExpandFields()` inside the object-provider fetch branch, which an inline schema
never reaches — so the call was pure waste, and the shorthand now behaves exactly like
the declared `{ provider: 'value', items }` form it is shorthand for.

Deleting the branch instead was measured, not assumed: with no producer-side handling,
an array-shorthand map renders `Error: DataSource required for object/api providers`
rather than its markers. The shorthand is a live convention in six sibling blocks
(`ObjectGrid`, `ListView`, `ObjectTree`, `ObjectChart`, `ObjectDataTable`,
`calendar-view-renderer`), so `object-map` would have become the one block in the family
that answers it with an error box.
