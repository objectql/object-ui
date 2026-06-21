---
"@object-ui/app-shell": patch
---

fix(app-shell): edit-in-studio pencil no longer overlaps interface-page toolbar buttons

The PageView "Edit in studio" pencil is an absolute overlay at the page's
top-right. On an interface (list) page whose header surfaces toolbar buttons
(e.g. an Approvals page's "Mark Done"), the pencil sat on top of the rightmost
button, clipping its label. PageView now tells InterfaceListPage to reserve
right padding on its header (`reserveEditAffordance`, only when the pencil is
shown) so the toolbar clears the affordance. Non-admin / non-editable pages are
unchanged.
