---
"@object-ui/components": patch
---

`ui:breadcrumb` and `ui:command` now resolve a child item's authored `icon` to a glyph instead of drawing nothing.

`BreadcrumbItem.icon` and `CommandItem.icon` are declared keys of the protocol — present in `@object-ui/types`, mirrored in the Zod schemas, and documented on both components' pages — and neither renderer referenced `icon` at all. The catalog fixture literally named `components-data-display-breadcrumb/with-icons` rendered no icons, and the nine names the two `command` fixtures declare all drew nothing. Both names are now resolved through `resolveIcon`, the same lucide **record** surface `ui:button`, `action:*`, `ui:dropdown-menu` and `ui:context-menu` resolve against: a live name draws its glyph, and an unknown or retired spelling draws nothing rather than degrading to a wrong glyph.

`breadcrumb` resolves once per item and draws the glyph above the page/link split, so the last crumb (rendered as the current page) carries it as well as the linked crumbs before it.

Two fixtures declared retired lucide spellings that are absent from the runtime `icons` record and would therefore have drawn nothing: `components-data-display-breadcrumb/with-icons` declared `layout`, now `panels-top-left`, and `components-form-command/command-menu` declared `smile`, now `face-slightly-smiling` — in both cases the live key the retired export resolves to by identity.

`ui:button-group` is NOT included: its fixtures author `icon` on `buttons[]`, but `ButtonGroupButton` declares no such key in `@object-ui/types` or its Zod mirror, so wiring it would first mean widening the published item contract. Routed for a decision rather than chosen (objectui#5931).
