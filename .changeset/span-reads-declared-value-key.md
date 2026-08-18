---
'@object-ui/components': patch
---

`span` renders the `value` its type and its published doc both declare, with child content winning when both are present.

Two declared authoring surfaces named `value` the text content of a span and the
renderer read neither: `TextSpanSchema` declares `value?: string` commented
`Text content` (`packages/types/src/layout.ts`), and the published doc's Schema
block lists the same key with the same comment. Before objectui#5027 the
renderer read `body`, which no producer emits; #5027 moved it to the canonical
`children`. Neither version ever read `value`. So an author writing
`{ "type": "span", "value": "hello" }` — exactly what the type and the docs
instruct — got an empty element, with no warning and no diagnostic. Same failure
shape as #5027 (content silently dropped), one key over, and not catchable on
the type surface: `BaseSchema` carries an index signature, so no spelling on
this node is ever a TS error.

Precedence, ruled 2026-08-17: `children` wins, `value` is the fallback. This is
the shape the sibling type in the same family already sets — `basic/text.tsx`
renders `schema.content || schema.value` — so `span` stops being the odd one out
rather than growing a rule of its own. "No child content" means an absent, empty
or empty-array `children`; that is exactly when `value` renders.

Both declared faces stay as written. The fix makes them true instead of
retracting a key that has been published as authorable. `body` remains refused
(objectui#5027): it is declared nowhere for this type, whereas `value` is
declared twice — the question is whether a key was published as authorable, not
whether a tolerant read would be convenient.
