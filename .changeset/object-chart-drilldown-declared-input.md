---
'@object-ui/plugin-charts': minor
---

`<ObjectChart>` declares `drillDown` as a registry input, so the SDUI save gate treats the segment drill as a contract prop instead of an unknown one (framework#5022).

The component has read `schema.drillDown` all along — it is what opens the drawer of underlying records when you click a bar or a slice — but the prop was declared in neither the protocol nor this registry entry. The manifest the save gate validates page JSX against is built verbatim from these `inputs`, so an author who wrote the drill got an `unknown-prop` diagnostic for a prop that works. `@objectstack/spec` now declares the shape (`ChartDrillDownSchema`, published on the react-tier `<ObjectChart>` contract); this is the renderer half.

The published input describes the six keys the spec declares — `enabled`, `filter`, `title`, `target` (`'drawer' | 'dialog'`), `columns`, `maxRows` — and deliberately not the wider `DrillDownConfig` this repo shares with the table / pivot / metric widgets: `ObjectChart` reads none of `mode` / `report` / `view` / `sort`, and does not implement `target: 'navigate'` (it renders the drawer instead — objectui#3354).

The untyped `(schema as any).drillDown` read is now typed as `DrillDownConfig`. Narrowing it to the spec's `ChartDrillDown` is left as a TODO on the version pin: `@objectstack/spec` is pinned at `^17.0.0-rc.2` here and the declaration lands in the next rc, and re-declaring the shape locally would be the fork that lets the two drift.
