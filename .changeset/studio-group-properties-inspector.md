---
'@object-ui/app-shell': minor
---

Studio form designer: select a field group to edit its properties.

Field groups (sections) in the Data → Form → Layout designer could previously only be renamed inline — there was no way to reach a group's other properties. Each group header now carries a settings affordance that selects the group into a dedicated **Group properties** inspector in the right rail (mirroring the field inspector): edit the group **name** and its **collapse behaviour** — the spec-canonical `collapse` enum (`none` / collapsible-expanded / collapsible-collapsed) that the form renderer consumes via `@objectstack/spec`'s `deriveFieldGroupLayout`, so the setting takes effect in the actual form/preview.

`readGroups` now preserves all authored group props (icon/description/collapse/…) instead of narrowing to `{key,label}`, so a read-modify-write round-trip (rename/reorder/inspector edit) never silently drops a property the source set. `icon`/`description` are round-trip-preserved but intentionally not surfaced as editable controls yet, since no renderer consumes them (no dead metadata).
