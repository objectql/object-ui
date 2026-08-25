---
"@object-ui/components": patch
---

`ui:context-menu` now resolves a menu item's authored `icon` to a glyph. It previously never read the key at all.

Both arms of `renderContextMenuItems` — the leaf `ContextMenuItem` and the `ContextMenuSubTrigger` — ignored `icon` entirely, so an item authored as `{ "label": "Copy", "icon": "copy" }` drew its label and nothing else. The name is now resolved through `resolveIcon`, the same lucide **record** surface `ui:button`, `ui:dropdown-menu` and the `action:*` family already resolve against: a live name draws its glyph, and an unknown or retired spelling draws nothing rather than degrading to a wrong glyph. This mirrors the repair `ui:dropdown-menu` received for the identical defect.

The `components-overlay-context-menu/basic-context-menu` catalog fixture already declared four live names — `copy`, `scissors`, `clipboard`, `trash` — which drew nothing before this change and draw their glyphs now. Those names are also brought under `check:lucide-icon-record-names` by a new `context-menu` census entry, so a future retired spelling fails the gate instead of silently drawing nothing.
