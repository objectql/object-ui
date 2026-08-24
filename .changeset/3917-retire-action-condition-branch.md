---
'@object-ui/types': minor
---

Retire the `ActionCondition` `{ expression, then, else }` branch shape from
`ActionSchema.condition` (objectui#3917, maintainer ruling 2026-08-09 route B,
enforce-or-remove).

`@object-ui/types` declared `condition` as a branch DSL — `expression` plus `then` /
`else` sub-actions — and shipped a zod mirror (`ActionConditionSchema`) that accepted it.
**Nothing ever read `expression`, `then` or `else`**: a repo-wide grep for
`condition.expression|then|else` has zero non-test hits. The only consumer of the key is
`ActionRunner.execute`, which reads it as a **predicate gate** (boolean / bare CEL /
`${...}` template / `{ dialect, source }` envelope). A branch object carries no `source`,
so the runner's normalizer read it as "no gate declared" and executed the action
unconditionally: the predicate was never evaluated, `then` / `else` were never dispatched,
and `os validate` / `os build` stayed green with zero diagnostics. Two docs pages taught
the shape with worked examples, so an author following the documentation
("amounts over 1000 go to manager approval") got unconditional execution.

What changes:

- `ActionCondition` is removed from `@object-ui/types` (and from the barrel export).
- `ActionSchema.condition` is retyped to the predicate the runtime actually honours:
  `boolean | string | { dialect?: string; source: string }` — the same three arms
  `ActionRunner`'s own `ActionDef.condition` carries, and the same vocabulary `visible`
  and `disabled` use.
- `ActionConditionSchema` is removed from `@object-ui/types/zod` (and from the zod
  barrel); the `condition` key now validates against that predicate union.
- The two teaching sites (`content/docs/core/enhanced-actions.mdx` Conditional Execution,
  `content/docs/api/schema-reference.md` ActionSchema table) are rewritten to the live
  vocabulary: `condition` is a gate; a branch is expressed as separate actions with
  mutually exclusive `condition`s.

**The zod parse verdict flips in both directions**, measured on `origin/main` @ `2aff580b5`
against this branch: the branch object went from **accepted** to **refused**
(`invalid_union` on `condition`), and every live predicate spelling — `false`,
`'data.amount > 1000'`, `'${data.amount > 1000}'`, `{ dialect: 'cel', source: ... }` —
went from **refused** to **accepted**. The old schema required `expression`, so the shape
the runtime honours was the one the schema rejected.

**Breaking for TypeScript authors of `ActionCondition` and for metadata authoring
`condition: { expression, then, else }`** — marked `minor` per this repo's
version-alignment rule, which reserves `major` for following `@objectstack` across a major
(AGENTS.md 版本号策略; same classification as the `MobileOverrides` retirement,
objectui#4919). Runtime behaviour is unchanged: an authored branch object did nothing
before and does nothing now. What changes is that the contract no longer claims otherwise
— the mistake now surfaces at authoring time as a type error and a named zod refusal,
instead of a silent no-op that type-checks, validates and runs the action anyway.
