---
"@object-ui/app-shell": minor
---

feat(studio): surface the `enable.searchable` toggle in ObjectSettingsPanel (#2800)

`enable.searchable` was corrected to LIVE during framework#2377 (the Global
Search executor gates on it — explicit `false` opts the object out of
cross-object search), making it the only live `enable.*` flag the Studio
settings panel did not expose. It now renders as an opt-out toggle (default
on) alongside feeds/activities/clone, with en + zh labels that point
field-level match configuration at `searchableFields` (ADR-0061) to avoid
conflating the two.
