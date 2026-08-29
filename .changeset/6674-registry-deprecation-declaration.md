---
'@object-ui/components': minor
'@object-ui/core': minor
---

Component deprecation is now DECLARED, not just warned about (objectui#6674).

A deprecated component type used to be stated in exactly two places, neither of
which a gate, a test or a type can consult: a `console.warn` string literal
inside the renderer, and the word "(Deprecated)" inside a human-readable
`label`. Both gates that touch component types ask a different question —
whether the type RESOLVES — and a deprecated type resolves, which is how one
could be authored 85 times across 27 shipped exemplars with every check green.

- `@object-ui/core` gains `ComponentDeprecation` / `AuthoringSurface` and the
  `deprecated` key on the registration metadata, plus
  `ComponentRegistry.deprecationFor(type, surface)` to read it back. The
  declaration carries the SURFACES it applies to rather than being a boolean:
  `div` and `span` are deprecated on the JSON authoring surface and are at the
  same time permanent vocabulary of the `kind:'html'` tier, so a bare flag would
  be false for one of its two readers.
- `@object-ui/components` marks `div` and `span` with the declaration their
  console notices already state. Nothing new is deprecated and no build starts
  failing: the catalog ratchet keeps the existing stock frozen, and draining it
  stays objectui#3965's worklist.
