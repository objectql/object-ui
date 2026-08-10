---
"@object-ui/plugin-list": minor
"@object-ui/app-shell": minor
---

fix(timeline): the timeline binds to the date axis the view actually declares (#3129)

A view whose date axis is bound under `calendar` was **offered** the Timeline
visualization and then bucketed every record into "No date" — while the calendar
rendered the very same field correctly. Two read-sites disagreed about what
counts as a timeline binding:

- `ListView`'s capability gate accepted `options.calendar.startDateField` as a
  timeline-resolvable axis; the render branch never read calendar config at all,
  so it fell through to its `created_at` last resort.
- `app-shell`'s object page emitted `startDateField: 'due_date'` into
  `options.timeline` for **every** object view, declared or not. Downstream that
  is indistinguishable from a real binding, and because it is always present it
  shadowed the fallback entirely.

`ListView` now resolves the axis once — `resolveTimelineDateBinding`, consumed by
the capability gate and the render branch alike, reading spec key before legacy
alias and `timeline` before `calendar` in both nestings — and the object page
forwards only what the view declared. A declared `timeline.startDateField` still
wins wherever both appear, and a view that declares no date axis anywhere keeps
the historical `created_at` fallback.

Observable rendering change (records move out of "No date" into real date
buckets), hence `minor`.
