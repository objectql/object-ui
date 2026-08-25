---
---

Docs only, publishes nothing: twenty-one TypeScript snippets across three
`content/docs/core/*.mdx` reference pages were fenced ```plaintext, so
`check-doc-snippet-types` — which reads only `ts` / `tsx` fences — never saw
them (objectui#5867, batch 2 of N). Triage's classifier is the one applied: a
plaintext block whose first line starts with `import` / `export` / `interface` /
`type X =` / `const x: T` is code, and those fences are now `ts` / `tsx`;
genuinely prose blocks on the same pages are left alone. Compiling them found
three real documentation defects, now fixed: `app-schema` documented an
`AppSchema` type `@object-ui/types` has never exported (the shipped name is
`AppComponentSchema`), and two `enhanced-actions` callbacks authored an
`ActionCallback.dialog` object with no `type` key, which `SchemaNode` requires.
Blocks that referenced ambient names are made self-contained with the import a
reader copying them needs. The gate's blocks-to-compile count rises from 181 to
202 — exactly the batch — with diagnostics at 0, no new `FRAGMENT_MARKER`
declarations, and the covered/ungated sets unmoved. The blocks also stop
rendering as unstyled plaintext and pick up TypeScript highlighting, which is
the reader-visible half.
