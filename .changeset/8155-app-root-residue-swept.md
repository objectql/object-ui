---
'@object-ui/react': patch
---

The published visibility diagnostic no longer tells an author that `app` is a bound
expression-scope root (objectui#8155 follow-up).

`@object-ui/react`'s `SCOPE_TIER_ADVICE['app-shell']` — the paragraph
`reportUnresolvableVisibilityPredicate` prints in production when a predicate cannot be
evaluated — read "App-shell predicates bind `current_user` … plus `app` and `features`".
objectui#8155 removed `app` from `buildExpressionScope`, so that sentence was printed at
exactly the moment a saved `app.*` predicate faulted, and it answered "why did my
predicate not resolve?" by naming the root that is the reason. The line now names the
five roots the provider really binds: `current_user`, its `user` / `ctx.user` / `os.user`
aliases, and `features`.

**Swept as a class, not as two coordinates.** Every other place in this tree that stated
`app` was a bound expression-scope root is corrected in the same change — the diagnostic
copy and its byte-pin, the ambient-scope docblocks in `@object-ui/react`
(`SchemaRenderer`, `useExpression`), `@object-ui/core` (`ActionRunner.ParamDef.visible`,
`RowPredicateOptions.scope`), `@object-ui/components` (`form.tsx`, `containers.tsx`),
`@object-ui/plugin-detail`, `@object-ui/plugin-form` (docblock and README),
`@object-ui/app-shell` and the console app, plus fourteen test fixtures that transcribed
the old bag with an `app` key. The fixtures in `@object-ui/app-shell` now call
`buildExpressionScope` instead of transcribing it, so that pair cannot drift again.

Nothing that was true before objectui#8155 changed: the `app` prop on
`ExpressionProvider` and the `app` field on its React context value are untouched (they
were never CEL roots), and no root other than `app` was added to or removed from any
message, bag or fixture.

Two release-bound corrections travel with it. The producer-side card objectstack#16420
was closed `not_planned` on 2026-09-07 by the same ruling that removed the root, not left
open; and the consequence of a stale `app.*` predicate is **not** uniformly "fails open" —
it is per surface, and the changeset that carries the removal now states the seven
measured directions instead of one.
