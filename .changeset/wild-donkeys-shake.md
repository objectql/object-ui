---
"@object-ui/plugin-map": patch
---

`ObjectMap` no longer serializes its data config on every render.

`getDataConfig(schema)` was called bare in the render body and its result
re-serialized with `JSON.stringify` on every render, purely to give `dataConfig`
the stable identity its fetch effect depends on. `getDataConfig` is a pure
function of `schema`, so `useMemo(() => getDataConfig(schema), [schema])` gives
the same identity with no serialize and no per-render rebuild.

This also fixes a crash. `JSON.stringify` throws on a value it cannot serialize,
and the config's passthrough branch returns the author's own `schema.data`
object verbatim — inline rows included. A map handed inline records carrying a
back-reference (an `$expand`-ed lookup) or a `BigInt` id threw from the render
body and took the whole map subtree down with it. Comparing identities never
serializes, so the config no longer has to be serializable at all.
