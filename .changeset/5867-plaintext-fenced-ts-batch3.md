---
---

Docs only, publishes nothing: seventeen TypeScript snippets across ten
`content/docs/fields/*.mdx` reference pages were fenced ```plaintext, so
`check-doc-snippet-types` — which reads only `ts` / `tsx` fences — never saw
them (objectui#5867, batch 3 of N). Triage's classifier is the one applied: a
plaintext block whose first line starts with `import` / `export` / `interface` /
`type X =` / `const x: T` is code, and those fences are now `ts`; genuinely
prose blocks on the same pages are left alone. Compiling them found two real
documentation defects, now fixed: `image` annotated `ImageFieldSchema.value`
with `FileMetadata`, a name `@object-ui/types` does not export — it was
deliberately renamed to `UploadedFileMetadata` (objectstack#4115) because the
spec's same-named type is the storage layer's file record, a different shape —
and `lookup` referenced `DataSource` without importing it. The gate's
blocks-to-compile count rises from 206 to 223 — exactly the batch — with
diagnostics at 0, no new `FRAGMENT_MARKER` declarations, and the
covered/ungated sets unmoved. The blocks also stop rendering as unstyled
plaintext and pick up TypeScript highlighting, which is reader-visible. Three
further `fields` pages are excluded by measurement with blockers filed:
`auto-number` (an ambient backend `db` handle), `object` (imports `ajv`, not a
workspace dependency) and `location` (one fence welds a JSX element and a bare
metadata object literal, so it parses as neither `ts` nor `tsx`).
