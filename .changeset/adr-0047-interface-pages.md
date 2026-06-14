---
"@object-ui/app-shell": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-grid": minor
"@object-ui/data-objectstack": minor
---

feat: ADR-0047 — interface pages, visualization switcher, and Airtable-parity filters

End-user interface/list pages reach full rendering and authoring parity:

- **Spec tabs + visualization switcher** — `ObjectView` now forwards
  `viewDef.tabs` (stored/served but never rendered) and `viewDef.appearance`
  (`allowedVisualizations` whitelist), turning on the dormant `ViewSwitcher` when
  more than one type is whitelisted; effective options = author whitelist ∩
  capability-resolvable types (kanban needs `groupBy`, calendar a date field, …).
  `ListView` accepts the canonical `ViewFilterRule[]` tab-filter shape.
- **User filters** — render only when `userFilters` is explicitly configured;
  selections (dropdown values + active tab) mirror into `uf_*` URL params and
  restore on load, so filtered lists survive reload and are shareable.
- **Toolbar polish** — the visualization switcher becomes a compact right-side
  "Grid ▾" dropdown inside the tool cluster (no extra row); filter tabs and
  dropdown filters are mutually exclusive.
- **Studio authoring** — a usable, schema-driven interface-page inspector
  (collapsible sections honoured, array-of-enum → multi-select, a None/Tabs/
  Dropdown `filter-mode` selector where None maps to ABSENCE of `userFilters`),
  and the Design/Preview tabs render the live list via `InterfaceListPage`
  (including a non-empty grid when the source view is hollow).
