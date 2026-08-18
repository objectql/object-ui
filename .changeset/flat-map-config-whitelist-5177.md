---
'@object-ui/plugin-view': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-map': minor
---

`ObjectView` and `ListView` now flatten a view's `map` block through a
whitelist instead of spreading the whole (untyped) block to the top level.

Both `case 'map'` flatteners used to build the `object-map` schema with
`...(options.map || {})` — a raw spread of an untyped bag
(`NamedListView.options?: Record<string, any>`), so any key an author wrote in
the `map` block reached the top level unfiltered. `ObjectMap`'s own
`FlatMapConfigKeys = Omit<ObjectMapConfig, 'style'>` declares `style` OUT of
this flat form (`style` is also `BaseSchema.style`, inline CSS legal on every
node), so the two disagreed about the same shape. `style` was the live
specimen: `map: { style: '<url>' }` reached the top level as a CSS-shaped
`style` key it was never supposed to carry.

Behavior narrowing, stated because it changes what reaches the flattened
schema: a `map` block key that is not one of `ObjectMapConfig`'s declared
flat keys (`latitudeField` / `longitudeField` / `locationField` / `titleField`
/ `descriptionField` / `zoom` / `center`) — including `style` — no longer
reaches the top level of the flattened `object-map` schema. This closes a gap
rather than removing working behavior: the pinned strict spec view schemas
accept no `map` block at all today, so no author-facing surface could reach
this path, and `ObjectMap` already stopped reading a top-level `style` as a
map style (a dev warning names the correct spelling instead).

The whitelist is DERIVED from `ObjectMapConfigSchema` (`@object-ui/types/zod`)
rather than hand-listed, so the flatteners and the declaration cannot drift
apart again — a key added to (or removed from) the schema reaches both
flatteners without a second edit. `ObjectMap`'s own `FLAT_MAP_CONFIG_KEYS` is
derived from the same schema for the same reason.
