---
"@object-ui/types": minor
---

`DashboardComponentSchema.widgets` gains the component-node arm on the TypeScript face (objectui#7952)

`widgets` was `DashboardWidgetSchema[]` in TypeScript while the zod schema it mirrors has been a two-arm union since the 2026-08-14 ruling (objectstack#8593): a component node placed directly in the widget slot (`type: 'metric-card'`, body validated as passthrough `BaseSchema`) or a spec-family widget. So the shape `@object-ui/plugin-dashboard`'s README teaches in every `metric-card` example — and the shape the shipped `DashboardRenderer` renders — parsed green under `safeParse` and was refused by `tsc --strict` (`TS2561: 'value' does not exist in type 'DashboardWidgetSchema'`, six occurrences across the README's dashboard blocks at `fc32921`). There was no annotation an author could write for a document the platform accepts.

**Accept-set change (Clause ②, TypeScript face only).** `widgets` is now `Array<DashboardWidgetSlotComponentSchema | DashboardWidgetSchema>`, and `DashboardWidgetSlotComponentSchema` — `BaseSchema` with `type` narrowed to the closed `DASHBOARD_COMPONENT_WIDGET_TYPES` — is a new export of `@object-ui/types`. The zod schema is unchanged; `DashboardWidgetSchema` is NOT widened with `value` / `icon` / `trend` / `trendValue` (those are `MetricCard`'s registry inputs, not widget keys — the compiler's `Did you mean to write 'values'?` points at the repair both declarations forbid).

**What still refuses.** A widget that names a spec-family `type` and carries an undeclared key (`{ type: 'bar', bogus: 1 }`) is still a `tsc` error: the literal is discriminated by `type`, so the passthrough arm never applies to it. A `type` outside both vocabularies is refused as before. The one corner the TypeScript union cannot discriminate — a legacy `component` envelope with NO `type` plus an undeclared key — compiles on the TypeScript face and is refused by name at validation, as every `BaseSchema` slot already behaves.

**Consumers.** The new arm is assignable to `DashboardWidgetSchema`, so code that annotates a widget callback `(w: DashboardWidgetSchema)` keeps compiling unchanged. Code that reads a property off an unannotated element of `schema.widgets` now sees the union, and through `BaseSchema`'s index signature that read is `any` rather than the widget's declared type — annotate the parameter to keep the narrower type.
