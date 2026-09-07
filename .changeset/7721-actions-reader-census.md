---
---

Correct a measured-false sentence in the pending objectui#7344 changeset, and widen the
reader census that produced it (objectui#7721).

`.changeset/7344-handler-string-any-mirrors.md` said `AppAction.onClick` retires because
"nothing reads `AppComponentSchema.actions[]`". The array IS read — `@object-ui/runner`'s
`LayoutRenderer` renders its `'button'` arm as toolbar buttons and its `'user'` arm as an
avatar dropdown. The retirement itself is correct and unchanged: what no reader touches is
`onClick`, on the action or on `items[]`. That sentence was future published
`@object-ui/types` CHANGELOG copy, so it is corrected before the next release rather than
after, when the CHANGELOG is history and no longer editable.

The census in `handler-keys-string-any-mirrors-7344.test.ts` was the origin: it scoped to
`@object-ui/layout`, `@object-ui/app-shell` and the console, which made it literally true
and its conclusion false. It is now an assertion whose population is read off the tree, so
a reader appearing in a package nobody listed fails the pin instead of narrowing the claim
in silence.

**Nothing published changes**: no accept set moves, no exported symbol changes, no
TypeScript face moves. The edits are one parenthetical in an unreleased changeset and one
pin's comment plus its new census — which is why this declares no bump. The `minor` the
objectui#7344 changeset already declares for `@object-ui/types` is the release this copy
belongs to.
