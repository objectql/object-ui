---
'@object-ui/react': minor
'@object-ui/fields': patch
'@object-ui/app-shell': patch
---

fix(detail): lookup field values link to the referenced record

A valued lookup on a record detail page rendered as plain text plus a copy
button — the referenced document's name was visible but unreachable, so users
copied the number and searched for it from the list page instead. Lookup cells
inside a related list that pointed at a third object were dead the same way.

`LookupCellRenderer` — the one cell renderer both surfaces resolve through —
now renders the display value as a link to the referenced record. The display
name resolution, the copy affordance and every non-lookup field are unchanged,
and a lookup with no value still renders its placeholder rather than an empty
link.

The URL is not assembled in the renderer. `RelatedRecordActionsContext` gains
an optional `recordHref` / `openRecord` pair, published by the console's
`RelatedRecordActionsBridge` from the SAME builder its related-list row
navigation already used, so there is one record-route shape rather than a
second one. A host that does not provide it (Studio designer, embedded
renderers, standalone grids) renders exactly what it rendered before.
