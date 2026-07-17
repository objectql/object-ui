---
"@object-ui/react": patch
---

refactor(spec-bridge): retire the hand-written `ListViewSpec`/`ListColumn` mirrors in the list-view bridge (#2231 follow-up)

The SpecBridge's list-view bridge kept a third hand-written copy of the ListView shape
(after the zod schema and the TS interface unified in the previous #2231 PR). It now
derives its input type from `@objectstack/spec/ui` (`Partial<ListView>`, spec `ListColumn`),
so the bridge can no longer drift from the protocol.

Behavior fix surfaced by the real types: spec `columns` is `string[] | ListColumn[]`, but
the old local interface only admitted `ListColumn[]` — a bare field-name column would have
produced a broken `{ accessorKey: undefined }` mapping. String columns now map to a default
column (`{ accessorKey: field, header: field }`).
