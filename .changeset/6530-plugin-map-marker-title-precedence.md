---
'@object-ui/plugin-map': patch
---

The package README stops documenting a marker-title fallback that objectui#5953 replaced.

`README.md`'s `map` block table described `titleField` as: "Omitted, markers are
titled `Marker`." That was true of the pre-#5953 read site, which bound the
marker title to a field name directly. objectui#5953 moved the marker title onto
`@object-ui/core`'s `getRecordDisplayName`, and `'Marker'` is now passed only as
that resolver's `fallback` option — a position the resolver reaches **only for a
record carrying no id at all**. A record with an id and no resolvable name reads
`Record #<id>`; a record whose object declares a `nameField` or a `titleFormat`,
or which simply carries a name-ish key, reads that. So "omitted ⇒ `Marker`" was
true in one narrow corner and false in the common case, and an author reading the
row would either under-specify `titleField` for a reason that stopped being true
or over-specify it to avoid a `Marker` that would never have appeared.

The row now names the precedence an omitted `titleField` hands the decision to:
the declared `nameField`, its deprecated `displayNameField` alias, the legacy
`titleFormat` template, a type-aware pick from the object's fields, then
name-ish keys read straight off the record — with `Record #<id>` as the floor and
`Marker` reached only by an id-less record.

Two details the row states deliberately:

- It does **not** describe an object-level `objectDef.titleField` rung. The
  resolver consulted one at step 0 as a second `??` leg, but objectui#6531 (PR
  #6560) removes it — `@objectstack/spec`'s object schema is a `strictObject`
  that rejects the key with `unrecognized_keys`, so no producer can ship it.
  What survives is `options.titleField`, which is exactly what `map.titleField`
  becomes at `ObjectMap`'s call site, so "a declared `titleField` wins" stays
  true either way and the row does not go stale when that lands.
- It names the record-key probe (the resolver's step 4b) as its own rung. That
  is not a footnote for this component: `ObjectMap` fetches an object schema
  only when `!hasInlineData && dataSource`, so for `staticData` or an inline
  `data` array no object definition ever reaches the resolver and the record-key
  probe is the only rung that can produce a title —
  `ObjectMap.markerTitle.test.tsx` pins exactly that case.

A second row falsified by the same commit goes with it. Two lines below the table,
the field-name defaults paragraph listed what an unconfigured map falls back to as
"`latitude` / `longitude` / `location` / `name` / `description`". objectui#5953 removed
the title default: `getMapConfig`'s default branch returns coordinate keys and
`descriptionField` only, under a comment that spells out why — "Deliberately NO
`titleField` (objectui#5953)… `getRecordDisplayName` resolves it from the object
definition, and it does so better than any literal here could". The paragraph now
lists the four defaults that exist and says where an unconfigured marker's title
actually comes from. Left alone in the same sentence: `map: { titleField: 'name' }`
still names no coordinate field and still renders an empty map, which is accurate.

Prose only: no behaviour changes, and the placeholders were already pinned in
order by `ObjectMap.markerTitle.test.tsx`.
