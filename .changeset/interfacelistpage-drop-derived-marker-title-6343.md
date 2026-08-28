---
'@object-ui/app-shell': patch
---

Interface-page maps: drop the derived marker-title binding, restoring the
object's own declaration as the authority

`defaultMapFromObject` bound a `titleField` alongside `locationField`, derived
from the object's display field. That binding was added to route around a forge
in `ObjectMap` — `getMapConfig` filled an absent `titleField` with the literal
`'name'`, and the marker title was a plain `record[titleField]` read, so an
object whose display field was not `name` titled every popup `undefined`. The
forge is gone: `ObjectMap` now resolves marker titles through
`@object-ui/core#getRecordDisplayName`, the same ADR-0079 resolver the kanban,
calendar and gantt renderers already used — which is why none of them binds a
derived title either.

What the binding did once the forge was gone was invert precedence. It reaches
the resolver as `options.titleField`, i.e. step 0 — ahead of `titleField` on the
object, ahead of the declared `nameField` pointer, and ahead of the legacy
`titleFormat` template. A field name derived by the page could therefore only
ever change the answer by out-ranking something the object itself declared; in
every other case it reproduced, at step 0, the string the resolver already
computes further down its ladder. The deriver now binds `locationField` and
nothing else, exactly like its kanban / calendar / gallery / gantt siblings.

No authoring surface changes. An author's own `map.titleField` is untouched — it
travels as the view-level `map` block, `ListView` merges it per key, and the
resolver honours it at step 0 by design. Objects that declare nothing resolve to
the same field as before, now via the resolver's own type-aware derivation
rather than a binding forced ahead of it; objects that declare a `titleFormat`
template (or a `titleField`) now have that declaration honoured on the map, as
it already was on every other visualization.
