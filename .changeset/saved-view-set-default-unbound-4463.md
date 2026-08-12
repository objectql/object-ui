---
'@object-ui/app-shell': patch
---

"Set as Default" and drag-reorder work again on saved views — the adapter's
`updateView` was being called unbound (objectui#4463).

`handleSetDefaultView` and `handleReorderViews` both detached the method into a
local before calling it (`const updateView = (dataSource as any).updateView;`
… `updateView(objectName, target, patch)`). Detached, `this` is `undefined`
inside the adapter, whose `updateView` opens with `await this.connect()` — so
every write in the list rejected with `TypeError: Cannot read properties of
undefined (reading 'connect')` **before a single request was issued**. QA
measured zero network requests, one console error and a "Failed to set default
view" toast; the view never gained `isDefault` and the prior default was left
in place. Rename and pin worked from the same menu because `handlePinView`
always called the method as a method — that is the convention this restores.

Both call sites now route through one exported helper, `dispatchViewPatches`,
which issues `dataSource.updateView(...)` as a method call. Having a single
dispatch site means there is no local left to detach into, so the two handlers
can no longer drift apart on this. Reorder's write set moves to a matching
exported helper, `reorderViewPatches`, so the `sortOrder` sequence it persists
is assertable without mounting the view.

Both handlers now also require a resolved `objectName` before writing, matching
the guard the view-override effect in the same file already used: the adapter
keys its cache invalidation on the object name, so a write issued under
`undefined` would have changed the server and then failed to invalidate what it
changed.
