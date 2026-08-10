---
"@object-ui/plugin-dashboard": patch
"@object-ui/types": patch
---

Studio's widget config panel no longer authors the retired `actionUrl` widget key

`actionUrl` / `actionType` / `actionIcon` were retired at the WIDGET level in
`@objectstack/spec` 17.0.0-rc.3 (objectstack#5010, ADR-0049 D2). They are
`retiredKey` tombstones: `DashboardWidgetSchema` types them `never` and refuses
any value, so authoring one is a tsc error and a parse error. Two producers in
`plugin-dashboard` were still emitting the widget-level key anyway
(objectstack#7129):

- `WidgetConfigPanel` offered a Behavior-group field labelled "Click-through
  URL", bound to `actionUrl`. That control was inert twice over: no dashboard
  widget renderer has ever read `widget.actionUrl`, so a URL typed there never
  navigated anywhere, and the value it wrote was refused by the spec.
- `DashboardWithConfig` seeded `actionUrl: widget.actionUrl ?? ''` into every
  widget config handed to the panel. Because the ADR-0021 save scrub only knew
  the dataset-shape keys, that seed rode through to `onWidgetSave` on EVERY
  save — so a Studio author who merely renamed a widget still persisted
  `actionUrl: ''` into stored metadata, a key the spec then refuses. This is
  the wider half of the defect: it did not require anyone to use the field.

The Behavior group and the seed are both gone, and `sanitizeDraftForType` now
scrubs all three keys as a second line of defence, for stored widgets that
already carry them and for hosts that drive `WidgetConfigPanel` directly.

Behaviour change surface: the widget config panel loses its Behavior section
(that section contained only this one field). Nothing that rendered before stops
rendering — the field had no consumer. `header.actions[]` keeps its own,
unrelated and still-live `actionUrl`; only the widget-level key is a tombstone.

Also corrects the `DashboardWidgetSchema` docblock in `@object-ui/types`, which
listed the three retired keys among those that "flow in from the spec" next to
live keys like `colorVariant`. They do flow in — as `?: never`. The docblock now
says so, and notes that while authoring one is a tsc error, *reading* one still
type-checks (`never | undefined`), which is exactly how these producers survived
the 2026-08-04 sweep that removed the renderer-side reads.
