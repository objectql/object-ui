---
'@object-ui/react': patch
---

`SchemaRenderer` now hands a stable `schema` object identity to a node carrying
`responsiveStyles` (objectui#6270).

ADR-0065 scoped styles make a styled node take a branch that rebuilds the schema
object to merge the generated scope class into `className`. That rebuild was not
memoised, so it allocated a new object on **every** `SchemaRenderer` render — even
when the `evaluatedSchema` memo directly above it held. Every downstream renderer
that memoises on `[schema]` therefore saw a fresh identity and re-ran: concretely
`ObjectMap`'s `dataConfig` and `mapConfig`, and the whole marker cascade below them
(`markers` → `filteredMarkers` → `clusteredData` / `markerBounds` → `initialViewState`).
Only nodes on that branch were affected — a plain node was already handed the
memoised `evaluatedSchema` itself.

The trigger is narrower than "has `responsiveStyles`" reads: it needs one of the four
sized breakpoint keys (`large` / `medium` / `small` / `xsmall`). A `{ base: … }` shape
never took the branch and was never affected.

The scoped-style computation now lives in a `useMemo` keyed on
`[evaluatedSchema, autoStyleId]`, hoisted above the renderer's early returns — its old
use site sits after them, so a memo written there would have been a conditional hook.
A genuinely changed `className`, interpolated value or breakpoint still produces a new
identity, so nothing goes stale.
