---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-view": minor
"@object-ui/app-shell": minor
---

Derive `ViewType` from `@objectstack/spec` instead of re-declaring it

`ViewType` and its zod face `ViewTypeSchema` were hand-written eleven-arm copies of
the spec's list-view type vocabulary. `@objectstack/spec@17.3.0` added `page` and
neither followed, so every structure keyed on them stayed total over the copy and
compiled green while being incomplete — including the one whose doc comment promises
that "a kind added to the union fails the build HERE". A spec-valid `type: 'page'`
view was left unresolved and fell back to a grid with no error, no warning and no
console line, while the published validator accepted it.

Both faces now derive from `@objectstack/spec/ui` `ListView['type']`, and the
renderer-side structures derive from that in turn:

- `@object-ui/core` exports `ListViewVisualization` and `isListViewVisualization` —
  the visualizations `ListView` draws, which deliberately exclude `page` for the same
  reason the spec's own `VisualizationType` does (a `type: 'page'` view mounts a
  published page through `pageName` rather than drawing records).
- A spec-valid but undrawable kind still falls back to a grid, but now warns once
  instead of degrading identically to a typo.

Widened surfaces: `ViewType` / `ViewTypeSchema` gain `page`; `UnifiedViewType` gains
`tree` (it had drifted); the `list-view` SDUI registry offers `chart` and `tree`,
which the renderer has drawn for releases.

⚠️ Consumers holding an exhaustive `switch` or a total `Record<ViewType, …>` will
now fail to compile until they account for `page`. That failure is the point of the
change — it is the guarantee that was silently lost.
