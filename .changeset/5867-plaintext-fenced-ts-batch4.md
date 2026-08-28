---
---

Docs only, publishes nothing: nineteen TypeScript snippets across
`content/docs/blocks/block-schema.mdx` and six `content/docs/plugins/*.mdx`
reference pages were fenced ```plaintext, so `check-doc-snippet-types` — which
reads only `ts` / `tsx` fences — never saw them (objectui#5867, batch 4 of N).
Triage's classifier is the one applied: a plaintext block whose first line
starts with `import` / `export` / `interface` / `type X =` / `const x: T` is
code, and those fences are now `ts`; genuinely prose blocks on the same pages
are left alone. Compiling them found real documentation defects on
`block-schema`, now fixed: the *Complete Example*, *Block Slots* and
*Marketplace Example* blocks annotated `BlockSchema` / `SchemaNode` /
`BlockLibrarySchema` without importing them, and three blocks referenced values
defined in other blocks on the page. Resolving `BlockLibrarySchema` then
un-masked a defect the unresolved name had been suppressing: both marketplace
listings carried `schema: { /* block schema */ }`, an empty object that
`BlockLibraryItem.schema` rejects because `BlockSchema` requires `type`. The
gate's blocks-to-compile count rises from 206 to 225 — exactly the batch — with
diagnostics at 0, no new `FRAGMENT_MARKER` declarations, and the
covered/ungated sets unmoved. The blocks also stop rendering as unstyled
plaintext and pick up TypeScript highlighting, which is the reader-visible half.
