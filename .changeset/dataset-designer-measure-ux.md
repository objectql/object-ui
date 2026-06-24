---
"@object-ui/app-shell": minor
---

feat(metadata-admin): friendlier + safer dataset measure authoring

The `dataset` designer's measure editor gets three improvements so a business
user can author measures without spec knowledge and without saving a broken
dataset:

- **Display-format picker** — replaces the raw `format` / `currency` numeral
  text inputs with a structured Kind (Raw / Number / Currency / Percent) +
  Decimals + Currency selection and a live sample (e.g. `US$1,234.50`). Parses
  an existing format string back into the picker, so editing an existing measure
  round-trips.
- **Auto-name from field** — picking a dimension/measure field when the row is
  still unnamed defaults the name to the field's leaf (`account.region` →
  `region`).
- **Author-time validation** — a `relationship.field` dimension/measure whose
  relationship isn't in `include` now shows an inline warning with a one-click
  "Add it", catching at design time the "relationship not declared in include"
  error that previously only surfaced when the live preview query ran. A derived
  measure with too few operands is flagged too.
