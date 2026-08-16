---
'@object-ui/app-shell': patch
---

The console's embedded index editor no longer offers controls for keys the spec removed.

`index` is an embedded-only sub-type with no metadata type of its own, so `/meta` has no
slot to publish a schema for it and `EmbeddedItemEditor` ships a hand-copied one in
`FALLBACK_SCHEMAS.index`. That copy had drifted from `IndexSchema`
(objectstack-ai/objectstack#5247), and `@objectstack/spec` 17.0.0 turned the drift from a
silent bug into a hard failure:

- **`type` ("Algorithm")** and **`partial`** were retired in spec 17.0.0
  (objectstack-ai/objectstack#5248, ADR-0049 enforce-or-remove) and are `retiredKey`
  tombstones today — `IndexSchema` rejects them at any value, so every option of the
  Algorithm select produced a 422 on the parent object save. Its `brin` option was never
  in the spec's enum to begin with.
- **`where` ("Partial-index predicate")** was never a declared key — the spec's spelling
  was `partial`, itself now retired — so an administrator's predicate was silently
  stripped on every save.

Both controls are removed. An index method is the driver/dialect's choice and a partial
index is built at the database layer by a runtime migration, so neither is a
declaration-surface concern.

`unique` is converged onto the ADR-0120 scope union: the console can now author
`'organization'` (one holder per organization, NULL-safe) and `'global'`, instead of only
emitting the deprecated bare `true` that protocol 18 rejects. Indexes already carrying the
boolean keep rendering their existing control and are saved unchanged.
