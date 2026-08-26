---
'@object-ui/plugin-designer': patch
---

The Field Designer builds an object's `fields` map by defining own properties and refuses
the three field lists a name-keyed map cannot carry (objectui#6489). `MetadataFieldsPage`
keyed the map by blind assignment — `nextFields[f.name] = fromDesignerField(…)` inside a
bare `for` loop — which failed silently in three directions, all measured on the installed
`@objectstack/spec` 17.2.0:

- **A field named `__proto__` never reached the wire.** `map['__proto__'] = def` invokes the
  prototype setter instead of creating a key, so the field vanished from the serialised PUT
  body. `__proto__` matches `ObjectSchema.fields`' key rule `/^[a-z_][a-z0-9_]*$/`, so the
  spec stood ready to accept the field the client had thrown away. The map is now built
  through `Object.fromEntries`, which defines an own property.
- **A nameless field was stored under the literal key `"undefined"`.** Measured:
  `ObjectSchema.safeParse` with `fields: { undefined: … }` returns `success = true`, so the
  document parsed, persisted, and had no reader anywhere. It is now refused before the
  request.
- **Two fields sharing a name collapsed into one entry.** A designer list carrying two
  `amount` fields PUT a single entry, the later silently replacing the earlier. Also refused
  before the request.

Both refusals raise before `client.save`, so a refused list issues no PUT at all, and the
message lands in the page's existing error surface naming the offending index — the caller
is fire-and-forget (`void handleFieldsChange(next)`), so throwing past it would show the
author nothing.

This is the plugin-designer port of the refusals objectui#6240 landed in the sibling object
writer (app-shell's `MetadataService.toFieldsMap`), down to the wording, so the two writers
of the objectui#5761 parity family cannot drift. `fromDesignerField`'s carry-over semantics
are untouched.
