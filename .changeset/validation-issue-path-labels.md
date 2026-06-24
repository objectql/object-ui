---
'@object-ui/app-shell': patch
---

Validation messages name the offending widget + field

A nested Zod issue (e.g. `widgets.2.layout`) was shown as just its head field label — "Widgets: Invalid input" — so an author couldn't tell which widget or sub-field was at fault. `labelForIssuePath` now appends a readable trail, resolving each array index to the item's stable identity (id/name/title, incl. I18nLabel objects) from the draft: "Widgets → priority_split → layout". Single-segment paths are unchanged.
