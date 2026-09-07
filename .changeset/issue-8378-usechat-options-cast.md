---
---

Removes the inert blanket `as any` on `useChat`'s options object in
`useObjectChat` (objectui#8378). Publishes nothing: the assertion lives inside a
function body whose export already carries an explicit return-type annotation, so
it is erased at emit. Measured rather than assumed — building
`@object-ui/plugin-chatbot` from this branch and from the merge-base produced a
byte-identical `dist` across all 34 published artifacts (`.d.ts`, `.js`, `.cjs`,
`.css`), and the comparison was proved live by a control mutation to an emitted
string literal, which the same comparison reported as differing.
