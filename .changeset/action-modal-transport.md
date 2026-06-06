---
"@object-ui/app-shell": minor
---

Action modal transport with placement (SDUI opt #2).

`useActionModal` provides a reusable `onModal` handler that renders an action's modal envelope in the right container by `placement`: `center` (Dialog), `side` (Sheet), `bottom` (Drawer), `fullscreen`. `content` is an arbitrary SchemaNode rendered via `SchemaRenderer`, so a modal action can open any page/form/list; string targets / `{objectName, mode}` keep opening a `ModalForm`. Wired into `RecordDetailView` so `type:'modal'` actions open client-side (previously routed to a server POST).
