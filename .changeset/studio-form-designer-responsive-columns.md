---
'@object-ui/app-shell': patch
'@object-ui/plugin-form': patch
---

Studio form designer + preview now match the runtime form's column density.

The Data pillar's **Form → Layout** designer laid every section out in a fixed 2-column grid capped at `max-w-3xl`, and **Form → Preview** capped the real `ObjectForm` at `max-w-2xl`. So on a wide screen the studio showed at most 2 columns while the record the end user actually edits spreads to up to 4 — the design surface misrepresented the real layout.

`ObjectFormDesigner` now derives its column count the same way the runtime form does (`inferColumns` over the object's editable field count, objectui#2578) and lays each section out with the shared container-query grid classes (`containerGridColsFor`) inside a per-section `@container`, so a field-heavy object reaches 4 fields per row on wide screens and collapses to one column when the panel is narrow. Wide widgets (textarea/markdown/html/…) span the full row, mirroring the form. Both the layout and preview canvases were widened to `max-w-6xl` so the container queries can actually reach 4 columns. `containerGridColsFor` is now exported from `@object-ui/plugin-form` as the single source of truth for these grid classes.
