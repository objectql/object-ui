---
---

Docs only, publishes nothing: twenty-four TypeScript snippets across thirteen
`content/docs/fields/*.mdx` reference pages were fenced ```plaintext, so
`check-doc-snippet-types` — which reads only `ts` / `tsx` fences — never saw
them (objectui#5867, batch 1 of N). Triage's classifier is the one applied: a
plaintext block whose first line starts with `import` / `export` / `interface` /
`type X =` / `const x: T` is code, and those fences are now `ts`; genuinely
prose blocks on the same pages (a bare object literal, a comment-only
illustration) are left alone. The gate's blocks-to-compile count rises from 157
to 181 — exactly the batch — with diagnostics at 0, no new `FRAGMENT_MARKER`
declarations, and the covered/ungated sets unmoved. The blocks also stop
rendering as unstyled plaintext and pick up TypeScript highlighting, which is
the reader-visible half.
