---
'@object-ui/types': patch
---

Declare `wrapperClass` on `CheckboxSchema`, on both faces (objectui#6938 — the
residue of that card; its `context-menu` half landed with objectui#6939 group 1).

`packages/components/src/renderers/form/checkbox.tsx:36` reads
`cn("flex items-center space-x-2", schema.wrapperClass)` — classes on the wrapper
`div` around the box and its label — and neither the TypeScript interface in
`packages/types/src/form.ts` nor the zod mirror in `zod/form.zod.ts` declared the
key. It compiled through `BaseSchema`'s index signature and parsed through
`.passthrough()`, admitted unexamined. The same key, on the same class of read, is
declared on `FileUploadSchema` and `FilterBuilderSchema` (objectui#6150); the
checkbox was left out only because its doc page's schema block is a six-line
summary.

**patch, not minor: the accept set only widens toward what already renders.** The
key is optional; no document that validated before stops validating. In the value
dimension the mirror now REFUSES a non-string `wrapperClass` it used to admit
unexamined — enforcement of the declared type, not a new capability.
