---
---

Type-only: `useRecordCrudVerdicts` now builds its `POST /api/v1/security/explain`
body against `@objectstack/spec/security`'s `ExplainRequest` instead of an
untyped object literal, and `RecordCrudOperation` is now a *declared* subset of
the spec's eight-verb `ExplainOperation` rather than a coincidental one.

No release: `satisfies` and the subset wrapper are erased at compile time, the
emitted JavaScript is unchanged, and `RecordCrudOperation` is not part of
`@object-ui/plugin-grid`'s public `.d.ts` (verified — it does not appear in
`dist/index.d.ts`).

What it buys is a class of compile errors the untyped literal accepted:
a renamed or mis-cased request key (`recordIDs`, `objectName`) and a verb the
explain API does not accept are now `tsc` failures at the call site instead of
a `400 VALIDATION_FAILED` — or, for a mis-cased `recordIds`, a request the
server reads as "no ids at all". Pinned at compile time in
`useRecordCrudVerdicts.explainRequest.test.ts`.

The narrowing at the heart of the hook is deliberately preserved: the two kebab
verbs stay written out locally, so an upstream release that adds a ninth verb
cannot widen what this list asks about. Only the request side is adopted — the
response stays `unknown` on purpose, because asserting the spec's entry type
would make the hook's fail-open runtime guards look like dead code.
