---
"@object-ui/types": minor
---

`ObjectChartSchema` declares `drillDown`, `title` and `compareTo` — on BOTH published copies of the shape.

`ObjectChart.tsx` reads all three off `schema`, and until now neither published copy declared any of them: not the TS interface (`packages/types/src/objectql.ts`) and not the zod mirror (`packages/types/src/zod/objectql.zod.ts`). They rode `BaseSchema`'s index signature / `.passthrough()` and arrived unvalidated. `drillDown` was the sharpest case — this component's registry `inputs` advertise it to the designer palette, and `@objectstack/spec` publishes `ChartDrillDownSchema` for exactly this carrier, so an author was offered a key that neither published shape mentioned.

Each key binds to the `@objectstack/spec` symbol that already owns it rather than to a local near-copy:

- `drillDown` is the spec's `ChartDrillDown` / `ChartDrillDownSchema`, whose own documentation names `<ObjectChart drillDown={…}>` as its carrier. Deliberately NOT this repo's wider `DrillDownConfig`: that type also carries `mode` and `report` for the table / pivot / metric widgets, and this component reads neither — so a chart drill now refuses those two by name instead of accepting and dropping them.
- `title` is the spec's `I18nLabel` — a plain string or an inline locale map, the union `normalizeChartSchema`'s `label()` already resolves and the union `ChartConfigSchema.title` carries.
- `compareTo` is bound by reference to `DashboardWidgetSchema.shape.compareTo`, which is literally where the value comes from: `DashboardRenderer` forwards the dashboard widget's own key verbatim onto the node.

What this buys is the VALUE check. `title: 42`, `drillDown: { target: 'popover' }` and `compareTo: { kind: 'lastWeek' }` are now compile errors and parse errors; before, all three rode through silently. It does not buy rejection of a misspelling — `BaseSchema` still carries `[key: string]: any` and is still `.passthrough()` — and the pin for this change states that bound honestly rather than implying more.

Four keys the same file reads (`xAxisKey`, `series`, `aggregate`, `filter`) belong to objectui#7946 and are ledgered by name, each with an assertion that it is still read, rather than swept in here.

Part of objectui#8885.
