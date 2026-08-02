---
"@object-ui/plugin-timeline": minor
"@object-ui/plugin-list": minor
---

fix(timeline,list): the timeline honours `timeline.dateField`, not just `timeline.startDateField` (#3129)

`dateField` is the pre-#2231 alias for `startDateField`. `@object-ui/types`
declares it on the nested config (`ListViewTimelineConfig`), and both
`ObjectView` read-sites (app-shell and plugin-view) resolve it — but the two
read-sites that actually drive the axis did not:

- `ObjectTimeline` consulted the alias only on the FLAT prop (`schema.dateField`),
  never on the nested `schema.timeline`.
- `ListView` resolved it out of `options.timeline` but not out of the
  spec-canonical `schema.timeline` — including in the capability gate, so such a
  view could fail to offer the Timeline option at all.

So a view authored as `timeline: { dateField: 'start_date' }` — the spec nesting
with the legacy key — fell through to the caller's default (`created_at` /
`due_date`). That field is normally absent from the `$select` projection, so
every record came back without it and the timeline rendered all of them under
**No date** — while the configured date was sitting in the row untouched. That
also explains why widening the view's projection changed nothing: the projection
already carried the right field; the renderer was reading a different one.

Both read-sites now resolve the alias in the same precedence position they
already use for `options.timeline.dateField`. The spec key still wins wherever
both appear. Observable rendering change (records move out of "No date" into
real date buckets), hence `minor`.
