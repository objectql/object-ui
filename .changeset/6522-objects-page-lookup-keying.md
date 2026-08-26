---
'@object-ui/plugin-designer': patch
---

`MetadataObjectsPage` keys its object-name lookups as own entries, so deleting an object
named `constructor` (or `__proto__`) from the Object Manager actually deletes it
(objectui#6522).

Both name lookups in the page were plain object literals filled by assignment, and the
consequential one was a READ. The delete scan asked `!nextByName[name]`, which for an
object named `constructor` answered out of `Object.prototype` with the `Object` function —
truthy — so the deletion read as "still present" and `client.reset('object', …)` never
fired. Not a refusal: the row disappeared from the manager, no error was shown, the save
reported success, and the object was still there after the next reload. Measured against
the installed `@objectstack/spec`, `ObjectSchema` pins object names to
`/^[a-z_][a-z0-9_]*$/` and accepts both `constructor` and `__proto__` — those two are
exactly the intersection with `Object.prototype`'s own names, so both are storable and
neither was deletable.

The second lookup, one function over, failed on the WRITE instead: `byName[item.name] =
item` for an object named `__proto__` invoked the prototype setter rather than creating a
key, so the object never became an own property, never reached the Object Manager at all,
and left its payload on the lookup's prototype chain for later name lookups to answer out
of. Both are now `Map`s — neither container is ever serialised, only its values are, so a
`Map` fits where the sibling `MetadataFieldsPage` fields map (which IS the PUT body) needs
`Object.fromEntries`.

Keying only. Nameless and duplicate entries behave exactly as before: this page writes
per-object, so the refusal semantics objectui#6489 added to the fields map are a separate
question and are deliberately not ported here.
