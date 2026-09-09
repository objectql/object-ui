---
'@object-ui/types': patch
---

Remove stale source-line citations (`NAME.ext:NNN`) from eleven published `.describe()`
schema descriptions in `packages/types/src/zod/form.zod.ts` (9) and
`zod/layout.zod.ts` (2) (objectstack-ai/objectui#8478).

Text only — no accept-set, key, or shape change. Each description was either trimmed to
its author-useful sentence with no loss (e.g. dropping "read at
renderers/form/file-upload.tsx:78" from an "appended to the renderer's own grid classes"
sentence that stands on its own), or rewritten to cite the same fact by identifier or
behavior instead of by file:line (e.g. "sets `required` on the Radix Checkbox and gates
the label's `*` marker" instead of "read at renderers/form/checkbox.tsx:45 ... and :49"),
which survives a line renumbering that a bare address would not.

Two of the eleven addresses removed here were measured to have already drifted by the
same +3 lines: `checkbox.tsx:45`/`:49` (actual `required=` site now `:48`, actual `*`
marker site now `:52`) and `text.tsx:162,167` (actual `{schema.content}` sites now
`:165`/`:170`). Filed back on objectstack-ai/objectui#8478 as further drift evidence for
its own pre-committed p3-to-p2 re-grade trigger.

The remaining 6 addresses (`zod/complex.zod.ts`) stay out of scope for this PR — held by
in-flight PR objectstack-ai/objectui#8799 — and the card does not close here.
