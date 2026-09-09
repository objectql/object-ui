---
'@object-ui/app-shell': patch
---

Canonicalize `reference` / `reference_to` on the BY-NAME object-schema serve path
too (objectui#7650).

`MetadataProvider` has two paths that hand an object schema to a reader, and only
one of them normalized. `ensureType('object')` — the LIST path — has run
`normalizeSchemaReferenceKeys` over every fetched item since objectui#2407 / PR
#2587. `getItem('object', name)` — the BY-NAME path, behind the published
`useMetadataItem` hook — ran `extractItem`, which unwraps the `{ item }` envelope
and normalizes nothing.

So which spelling a reader saw depended on **cache order** rather than on the
document: warm (the list had already been fetched) it got the def with both keys
stamped, cold it got whichever single key the producer had stored. A consumer that
reads one key rendered a raw id in the cold case and the relation in the warm one —
the objectui#2407 bug, still reachable through the one door left open.

This matters because the serve path never parses. objectui#7650 measured that
`ObjectStackAdapter.getObjectSchema` applies exactly two mutations and runs no
`ObjectSchema.parse` at all, so `FieldSchema` strictness gates the WRITE door only:
a document stored before a key was tightened is served back verbatim, forever, and
a host with its own `getObjectSchema` is served straight through.

`getItem` now applies the same idempotent, in-place stamp for `type === 'object'`,
so a def the list pass already normalized is untouched, and no other metadata type
is affected. Nothing is dropped or overwritten: a spelling the producer set keeps
its own value.
