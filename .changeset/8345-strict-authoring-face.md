---
'@object-ui/types': minor
---

Publish the derived strict authoring face from `@object-ui/types/zod`
(objectui#8345, under the objectui#5250 ruling — maintainer 2026-09-04,
decision batch #25, option 2: "each node schema gets a derived strict variant;
`objectui validate` and the doc-snippet gates run strict; renderer props keep
the tolerant face unchanged").

**Additive. No existing accept set moves.** `BaseSchema` keeps its
`.passthrough()`, every published mirror keeps the documents it accepts today,
and no consumer in this repository is wired to the new face — wiring
`objectui validate` and the JSON-fence gate is a separate card. What is new:

- `StrictAnyComponentSchema` — the document-root twin of `AnyComponentSchema`,
  refusing any undeclared key at any depth with an `unrecognized_keys` issue
  that names it.
- `StrictSchemaNodeSchema` — the child-slot twin of `SchemaNodeSchema`.
- `deriveStrictAuthoringSchema(schema, options)` — the derivation itself, so a
  consumer can take the strict twin of any schema on the face rather than
  writing a second walker.

The twins are **derived**, never hand-written: every reachable object is closed
through unions, discriminated unions, arrays, tuples, records, intersections,
optionals, nullables, defaults, both sides of a pipe, and `z.lazy`. Objects are
cloned by patching a copy of their own def, so `.refine()` and `.superRefine()`
checks survive — a twin rebuilt with `z.object(shape)` would drop them and
under-report. Opaque `custom` / `function` / `transform` validators have no
shape to close and are reported through `onOpaqueShape` rather than skipped.
