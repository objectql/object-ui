---
'@object-ui/fields': minor
---

**API addition (public-surface widening):** `FileCell` — the compact upload
control `@object-ui/fields` exports for line-item grid cells — gains the
published optional `error?: string` slot, mirroring `LookupField` and
`FileField`: the same validation slot `@objectstack/spec/ui`'s
`FieldWidgetPropsSchema` declares and `FieldWidgetComponentProps` names
(objectui#3222). When set, `FileCell` puts `aria-invalid` on its own focusable
picker button; the message text stays with the host (objectui#5431).

`GridField` now passes that slot for a required-but-empty `file` cell — the one
cell type objectui#3318's per-cell `aria-invalid` delivery left out. Before
this, a required `file` cell flagged only the visual ring and `title` on the
`td`; no element in the cell subtree announced the state, so assistive tech was
told nothing (a wrapper-only mark is exactly what objectui#5223 forbids). Text,
number, select, and lookup cells were wired in PR #5429; `file` cells now
behave identically.
