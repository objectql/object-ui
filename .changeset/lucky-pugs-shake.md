---
"@object-ui/components": patch
---

`ui:dropdown-menu` now resolves a menu item's authored `icon` to a glyph instead of drawing the name as raw text.

Both arms of the item renderer — `DropdownMenuItem` and `DropdownMenuSubTrigger` — rendered `icon` straight into a text node, so an item authored as `{ "label": "Copy", "icon": "copy" }` drew the literal word `copy` beside its label. The name is now resolved through `resolveIcon`, the same lucide **record** surface `ui:button` and the `action:*` family already resolve against: a live name draws its glyph, and an unknown or retired spelling draws nothing rather than degrading to a wrong glyph.

The `components-overlay-dropdown-menu/with-icons` catalog fixture declared the retired lucide spelling `edit`, which is absent from lucide's runtime `icons` record and would therefore have drawn no glyph; it now declares `square-pen`, the live key the retired export resolves to by identity.
