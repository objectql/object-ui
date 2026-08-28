---
---

Docs only, publishes nothing: `content/docs/fields/location.mdx`'s *Integration
with Maps* fence welded two different examples into one block — an import plus a
JSX element (which needs `tsx`), immediately followed by a bare metadata object
literal at statement position (which `tsx` reads as a labelled statement, then
fails on the commas). Measured standalone with the repo's own TypeScript on
`origin/main`: **2 syntactic diagnostics as `ts`, 5 as `tsx`** — it parsed under
neither fence language, which is why `location.mdx` was excluded from objectui#5867
batch 3 by measurement (objectui#6127). The fence is now **split in two**, each half
fenced for what it actually is: a `tsx` block holding the widget example, made
self-contained so it compiles (it renders `LocationField` with a typed
`LocationFieldMetadata` and a state-held coordinate pair, instead of spreading an
undeclared `props`), and a `jsonc` block holding the `object-map` metadata node —
which is a schema-key question `check-doc-snippet-types` explicitly says it does
not answer. Connecting prose numbers the two halves so the section still reads as
one example. The page's *Field Schema* block, the other fence triage's classifier
calls code, is re-fenced `plaintext` → `ts` in the same pass; the two genuinely
prose fences (`{` and `// Valid coordinates`) are left alone.

Accounting, stated because splitting a fence breaks the plain "blocks-to-compile
rises by exactly the batch size" identity this card family has used across three
batches: **1 block re-fenced, plus 1 fence split into 2 of which 1 half is
TypeScript, so blocks-to-compile rises by 1 + 1 = 2** — measured 206 → 208, with
diagnostics at 0, declared fragments unmoved at 111, and the covered/ungated sets
unchanged. The page's fence count rises 4 → 5. Both blocks also stop rendering as
unstyled plaintext and pick up TypeScript and JSON-with-comments highlighting,
which is reader-visible.
