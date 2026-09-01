---
'@object-ui/data-objectstack': patch
---

Parse a `droppedFields` wire entry's `fields` elements and its `object` at the
write-warning boundary instead of asserting them.

The structural gate checked `Array.isArray(fields) && fields.length > 0` and then
asserted the entry into a type declaring `fields: string[]` and a required
`object: string` — reading neither. A response carrying `fields: [42]` reached
`onWriteWarning` subscribers typed as a field name (the shell rendered it as the
label `42`), and an entry that omitted `object` arrived claiming a string that was
not there.

Now the wire type declares only what the gate establishes, and the notice is
parsed: non-string `fields` elements are refused, an entry naming no field at all
is dropped as `fields: []` already was, and a missing or non-string `object` is
healed from the object the write targeted. Warnings are never silenced for a
field the server really did name. No published type changes — `WriteWarningEvent`
and `DroppedFieldsNotice` keep their shapes, and a subscriber's `fields: string[]`
is now true rather than asserted.
