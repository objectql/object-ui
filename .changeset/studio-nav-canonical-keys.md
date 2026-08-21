---
'@object-ui/app-shell': patch
---

Studio Interfaces: the nav-leaf binding reads the canonical target key only

`resolveSurface` fell back to the bare spellings `page` / `object` /
`dashboard` / `report`, and carried a `case 'view'`. Every
`NavigationItemSchema` member is a `strictObject`, none of those bare
spellings is in any variant's shape or in `NAV_ITEM_ALIASES`, and `view` is
not one of the union's nine members — so all of them are keys `AppSchema`
answers with `unrecognized_keys`, and every one of those branches could only
fire on an app that cannot be saved. The Studio nav item inspector's object
picker likewise read `node.object ?? node.objectName`, preferring the rejected
spelling over the canonical one; it now reads the canonical key first.

No shape that parses today stops parsing: this narrows the designer back to
what the contract already declares.
