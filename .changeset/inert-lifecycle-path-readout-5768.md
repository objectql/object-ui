---
'@object-ui/plugin-detail': minor
---

`record:path` stops looking like a control it cannot be.

The record page draws the object's lifecycle across the top from the
`stageField` role, and it drew each stage as a filled, shadowed, equal-width
pill — a segmented button group, sitting exactly where a CRM user reaches for
the stage control. Nothing was behind it. Measured in a browser on a shipped
build (HotCRM `crm_quote`, and this is generic record chrome, so every object
that declares a `stageField` has it): the segments were `role="listitem"` with
`cursor: auto` and `tabindex` null, no ancestor `button`/`tab`/`a`, and a full
pointer sequence (pointerdown → mousedown → pointerup → mouseup → click) left
the record's status untouched. Advancing a record needs the edit form or a bulk
action. Users spent two or three clicks on the path before concluding it was
decoration.

There is no write path to connect it to, and this change does not open one:
this renderer's only channel is `useRecordContext()`, whose value exposes
`data` / `refresh` / `headerSystemActions` / `onToggleFavorite` and no
record-field mutation. Editing runs through `record:details`'
`<InlineEditProvider>` + `<InlineEditSaveBar>` (`dataSource.update(...,
{ ifMatch })`) or an action via `useActionEngine`; neither reaches this
component.

So the promise is withdrawn rather than honoured. Each stage now renders as a
thin decorative rail segment with its label as plain text beneath it — the
vocabulary app-shell's approval step readout already uses. Gone: the per-stage
filled pill, the shadow, the ring, the bordered chip, the equal-width tap
target. Kept exactly as they were: which stage is current (`aria-current="step"`
and type weight), the travelled/untravelled distinction, the check on completed
stages, and the separated `lost`-terminal group. The accessible semantics did
not move — `role="list"` / `role="listitem"` with no tab stop was already
correct for a readout, and it stays that way.

Three DOM attributes carry the state that colour used to be the only carrier
of, so the classification is assertable without reading CSS:
`data-stage-state` (`completed` | `current` | `upcoming`),
`data-stage-terminal` (`won` | `lost`), and `data-stage-rail` on the decorative
indicator.

**Not in this change:** click-to-advance. A stage control that writes
`stageField` through the same permission/validation envelope an edit takes is a
separate feature with its own appetite, and folding it in here was explicitly
ruled out.
