---
---

Records, at the Save gate, why the metadata editor's two author-time error
sources are treated differently — and pins the asymmetry so it cannot be
"fixed" by accident (objectui#6980). Comment + test only; no behaviour change.

`ResourceEditPage`'s Save gate has one validation term, `inspectorBlocking`.
The live client Zod pass (`validateMetadataDraft`) feeds the banner, the inline
field errors and `previewDiagnostics`, and gates nothing. From outside that
reads as a defect. Measured, it is the right shape, and the discriminator is
whether the server is a backstop for the class:

- Inspector issues (a CEL predicate that does not parse) have none —
  objectui#4306 measured such a formula saving 200 and publishing as the live
  field definition, and the runtime authoring gate reports only advisory
  findings on an already-successful save (#4133). The client is the only gate.
- Schema issues have one — `saveMetaItem` runs the same contract, and `doSave`
  already maps its 422 / `INVALID_METADATA` / `INVALID_PAYLOAD` refusal back
  into the same inline issues. The live Zod pass is a preview of the server's
  verdict, not the thing keeping the draft out of storage.

So the only failure a blocking Zod gate could add is the client being STRICTER
than the server, which is not hypothetical (objectstack#5316: stored views
carrying the platform's own `isPinned` / `sortOrder`). `clientValidation.ts`'s
root-cure covers exactly one class of that skew — a top-level required field,
absent, that the server marks optional (`path.length === 1`). Measured on the
bundled spec 17.2.0, 14 of the 15 wired schemas reject an undeclared key, and
`unrecognized_keys` arrives at `path.length` 0 or 2, which that filter passes
through. A server that gains one authorable key would, under a blocking gate,
dead-bolt Save on a draft the server accepts, with no on-screen editor able to
take the key back out — the same wedge every gate in this family is built to
avoid.

`ResourceEditPage.schemaAdvisory.test.tsx` pins both halves against one draft:
an undeclared root key is reported in the banner while Save stays enabled, and
one added CEL parse fault on the same draft disables it.
