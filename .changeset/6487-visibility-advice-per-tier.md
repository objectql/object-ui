---
'@object-ui/react': minor
'@object-ui/app-shell': minor
'@object-ui/components': minor
---

**The unresolvable-visibility-predicate report now names the roots of the tier the
predicate was actually evaluated against** (objectui#6487). An app-shell author
whose nav, area or field `visible` faulted was told to check `record` and
`page.<var>` — two roots that tier does not bind at all.

`formatUnresolvableVisibilityMessage` and `reportUnresolvableVisibilityPredicate`
(both exported from `@object-ui/react`) take a new **optional sixth argument**, a
`PredicateScopeTier` — also exported — selecting the closing advice paragraph.
Everything above that paragraph is unchanged on every surface, and so is every
verdict: this is diagnostics copy only.

**The published signature grew; nothing existing breaks.** The argument defaults
to `'page-component'`, so a five-argument call keeps printing the bytes it
printed before. All three in-repo call sites pass their tier explicitly rather
than lean on that default.

Each tier's root set was derived from the code that builds the bag, not from the
prose that described it:

- **`'page-component'`** — `SchemaRenderer`'s node gate and `page:tabs` item
  predicates. Both bind `record`, `current_user` and `page.<var>` (the roots
  `@objectstack/spec`'s `ui/page.zod.ts` declares for the tier). Its paragraph is
  byte-for-byte what it was.
- **`'app-shell'`** — the chrome gate `ExpressionProvider.evaluateVisibility`
  runs, wired onto this reporter by objectui#6443. Its evaluator is built from
  `{ current_user, user, ctx: { user }, os: { user }, app, data, features }`, so
  the line now names `current_user` with its three ADR-0068 alias spellings,
  `app`, and `features` — the deployment-flag root that provider documents for
  exactly this kind of predicate — and states outright that `record` and
  `page.<var>` do not exist there.

**Why not generalise the copy instead.** Dropping the concrete root names would
have made one paragraph true everywhere at the cost of making it useful nowhere:
an author who mistyped a root needs to know which roots exist *at their tier*,
which is the whole reason the paragraph is read.

`data` is bound at the app-shell tier but is deliberately not advertised there —
every mount of `ExpressionProvider` in this repo passes `data={{}}` or omits it,
so naming it would point an author at a root that answers nothing.
