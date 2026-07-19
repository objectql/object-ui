---
"@object-ui/core": minor
"@object-ui/app-shell": minor
"@object-ui/plugin-report": minor
"@object-ui/plugin-dashboard": minor
---

feat(report): drill a date-bucket cell into its time range, not a superset (#1752)

Clicking a report/dashboard cell grouped by a `dateGranularity` date dimension
("2026-Q2") used to drill into a **superset** — the date dimension was skipped,
so the record list spanned every time bucket. It now scopes to the clicked
bucket's half-open range, consuming the framework's new `drillRanges` sidecar.

- **`@object-ui/core`** — `buildDatasetDrillFilter` accepts the per-row
  `drillRanges` and emits an ObjectQL range operator object
  (`{ [field]: { $gte, $lt } }`) alongside the equality dims.
- **`@object-ui/plugin-report` / `@object-ui/plugin-dashboard`** — the report
  renderer and dashboard widget forward `drillRanges`, and a **date-only**
  report (no equality drill dim) is now drillable via the range alone.
- **`@object-ui/app-shell`** — the "Open in list →" escape hatch
  (`useOpenRecordList`) now targets the ADR-0055 **bare data surface**
  (`/:object/data`, "the URL is the view" — no baked-in view filter to
  over-narrow the drill) and serializes a range to the
  `filter[field][gte|lt]` operator contract. `ObjectDataPage` parses those
  operators (equality shorthand unchanged), renders a range as a single chip,
  and removes both bounds together. A new `drillUrlFilters` module owns the
  write/read serialization so both sides can't drift (round-trip tested).

Companion to the framework analytics change (objectstack-ai/framework#3256).
