---
'@object-ui/components': patch
---

fix(components): keep MobileDialogContent open when interacting with a portalled dropdown

Radix Select / Popover / DropdownMenu render their flyout into a portal at
`document.body`, outside the dialog's DOM. Clicking an empty part of an open
dropdown registered as an "interact outside" and closed the entire dialog
(create/edit forms). `MobileDialogContent` now guards `onInteractOutside`:
interactions whose real target is inside a Radix popper layer are ignored
(the popper dismisses itself), while a genuine backdrop click still closes the
dialog as before.
