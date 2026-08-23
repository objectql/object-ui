---
'@object-ui/plugin-view': minor
'@object-ui/app-shell': patch
---

Remove the inert `showRefresh` designer input from the `object-view` registration (objectui#5567).

The `object-view` designer no longer offers a "Show Refresh Button" toggle, and the registration no longer defaults `showRefresh: true`. The key was declared, documented, and defaulted, but `ObjectView` never read it — an author who wrote `showRefresh: false` on an `object-view` node always got a no-op. **Behaviour is unchanged for every existing app**, because nothing ever consumed the key.

Migration: nothing to do. If you wrote `showRefresh` on an `object-view` node, the key simply disappears from the designer's property panel; it never controlled anything. The live refresh channel is `userActions.refresh` (rendered by the list toolbar in `@object-ui/plugin-list`), which is unaffected. `showRefresh` on other surfaces (e.g. `CRUDToolbar`) is also unaffected.

`@object-ui/app-shell` only drops its two producer writes of the dead key (the app `ObjectView` wrapper and the metadata-admin `ViewPreview`) — no user-visible change.
