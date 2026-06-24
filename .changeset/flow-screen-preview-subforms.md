---
'@object-ui/app-shell': patch
'@object-ui/plugin-form': patch
---

Flow Screen preview: render inline master-detail subforms (follow-up to #1944)

The object-form mode of the Screen-node preview now renders inline master-detail
child grids, matching runtime. `ScreenPreview` feeds the SAME enriched object
list the runtime `FlowRunner` uses (`useMetadata().objects`, which derives
`form.subforms` from `inlineEdit` relationships via `attachInlineSubforms`), so
e.g. a `showcase_invoice` object-form step previews its **Line Items** grid
(with live Subtotal/Tax/Total) — only fetched in object-form mode.

To keep the preview non-persisting — consistent with the flat-field preview
(disabled Submit) and the simple object-form preview (no Save) — `MasterDetailForm`
now honours a `showSubmit` flag (default shown; backward-compatible) that
`ObjectForm` forwards, so the preview hides the master-detail Save bar. Also drops
a dead `e = formData` assignment in `ObjectForm` (lint `no-useless-assignment`).
