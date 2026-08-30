---
'@object-ui/plugin-timeline': patch
'@object-ui/i18n': patch
---

fix(plugin-timeline): refuse an unusable gantt date range with a diagnostic that names the offending value

A gantt whose date range cannot be used now renders a `role="alert"` diagnostic
naming the value that made it unusable, instead of crashing or drawing a chart
that is confidently wrong. Two input classes, which failed in opposite
directions:

- A date that does not parse threw `RangeError: Invalid time value` mid-render —
  the same crash site objectui#6750 guarded for the empty list, on a different
  input. This covers a malformed value (`startDate: 'not-a-date'`), an absent
  one, and an unparseable `minDate` / `maxDate` pinned on the schema.
- An inverted pinned range (`minDate` after `maxDate`) drew a bar at
  `left: 157.9%; width: -4.3%` under a header row with zero cells, with no
  error and no diagnostic.

Valid gantts, the empty-list sentinel from objectui#6750 and the degenerate
`minDate === maxDate` axis are unchanged.
