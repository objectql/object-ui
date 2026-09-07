---
---

Test-only change (objectui#7884): the `defaults-maps-mirror-en-pack` gate's rule "every
row names a key the en pack actually defines" now runs over the `createSafeTranslation`
defaults tables discovered from source, instead of a hand-written list of three imported
maps that judged 400 of 1056 rows. The AST walk objectui#3512 already had moved into
`@object-ui/test-support` (private, never published) so both gates share one definition of
the population rather than growing a second traversal. No published behaviour changes.
