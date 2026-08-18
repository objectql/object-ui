---
'@object-ui/plugin-map': patch
---

A map node's top-level `style` is inline CSS again, not a MapLibre style URL.

`ObjectMap.getMapConfig` resolved the map style from three spellings with the
top-level `style` FIRST — `schema.style || schema.mapStyle || schema.map?.style`
— but `style` is `BaseSchema.style`, a record of inline CSS properties that
every schema node may legally carry. Writing the base face's own
`style: { height: '400px' }` on a map node therefore handed that object to
MapGL's `mapStyle` prop: it never passed the config `safeParse` (which only ever
looked at `schema.map`), so there was no validation and no diagnostic either.

`@object-ui/types` had already named the map's key `mapStyle` — explicitly "not
`style`, to avoid colliding with `BaseSchema.style`" — so the consumer was
reading, at top priority, the very name the declaration went out of its way to
avoid. The declaration is now what is enforced: the map style comes from
`mapStyle` on the schema or `style` inside the declared `map` block, and a
top-level `style` is not consumed as a map style in any shape.

Behaviour change, stated because it is one: a map configured through a top-level
`style` URL now renders with the default public demo tiles. That spelling was
never documented (the README teaches `map.style`) and no metadata in this repo
used it, but it was runtime-reachable one way — `ObjectView` / `ListView`
flatten `options.map`'s CONTENTS to the top level, so a view authored with
`map: { style: '<url>' }` arrived here as a top-level string. That shape is not
spec-authorable (`@objectstack/spec`'s list-view schemas are strict and declare
no `map` block at all, so such a view fails validation outright), and it now
gets a dev warning naming both surviving spellings rather than silently painting
the demo tiles. The object form gets no warning: legal base-face authoring, and
dropping it is the fix.
