---
"@object-ui/plugin-dashboard": patch
"@object-ui/fields": patch
---

fix: read spec-canonical keys for dashboard header title and field length rules

Two naming-drift closeouts (framework#1878 / framework#1891):

- `DashboardRenderer` header now falls back to the spec-canonical `label` when
  the legacy `title` is absent (mirrors the `DashboardGridLayout` fallback from
  #2666) — a spec-compliant dashboard gets its header title.
- Field validation rules now read the spec-canonical camelCase
  `minLength`/`maxLength` (what the server record-validator enforces) with the
  legacy snake_case `min_length`/`max_length` kept as fallback — authored
  length constraints reach the client form.
