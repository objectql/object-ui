---
"@object-ui/app-shell": minor
---

metadata editor: `view-ref` widget for picking a source view

Adds a `view-ref` form widget so `interfaceConfig.sourceView` (and any field with `widget: 'view-ref'`) renders as a dropdown of the source object's views instead of a free-text name the author could mistype. Views come from a new `WidgetContext.objectViews`, which `ResourceEditPage` loads for the page's source object (`interfaceConfig.source` / `object`). A value not in the catalog is still shown so stale/custom names survive; clearing to "None" omits the field (the protocol treats absence as the object's default view). The widget mirrors the existing `field-ref` picker and degrades gracefully when no source object is bound.

Pairs with the `@objectstack/spec` change that sets `widget: 'view-ref'` + `dependsOn: 'source'` on the page form's `sourceView` field.
