---
'@object-ui/types': minor
---

Three exported type names inside `@object-ui/types` had two authorities each; each now has
one (objectui#6349, first batch — the three intra-package collisions from the 46-name
census on objectui#6273).

**`ActionSchema` — renamed, because the two shapes are unrelated.** `crud.ts` and
`ui-action.ts` both declared it. Measured member-by-member they share 9 keys out of 28 each:
`crud.ts` `extends BaseSchema` and pins `type: 'action'` (a UI node — a button in a
component tree), `ui-action.ts` extends nothing and types `type` as `ActionType` (a spec-v2
action definition, with `name`, `locations`, `params`, `target`). Re-pointing either at the
other would silently hand a consumer a different type, so this took the rename branch
(objectui#5044 is the precedent for choosing the surviving name). `ui-action.ts`'s
declaration is now spelled **`UIActionSchema`** — the name `src/index.ts` has always
PUBLISHED it under, via `export type { ActionSchema as UIActionSchema }`, which is now a
plain re-export. **The package's public surface is unchanged**: `ActionSchema` still means
`crud.ts`'s legacy shape and `UIActionSchema` still means `ui-action.ts`'s, exactly as
before. Nothing outside `ui-action.ts` imported the old spelling — there is no `./ui-action`
subpath in `exports`, so the old name was never reachable from outside the package.

**`BreadcrumbItem` / `BreadcrumbSchema` — re-pointed, because one copy was stale.** Both
were declared in `data-display.ts` and in `navigation.ts`. The data-display pair was not a
second dialect but a strict SUBSET: no key declared differently on either side, and missing
`BreadcrumbItem.icon` / `onClick` / `siblings` and `BreadcrumbSchema.maxItems`. Everything
that reads a breadcrumb was already on the navigation declaration — `registry.ts` maps the
`'breadcrumb'` component type to it, `src/index.ts` re-exports it under the bare names,
`zod/navigation.zod.ts` mirrors it (`icon`, `onClick`, `siblings`, `maxItems` included), the
`ui:breadcrumb` renderer consumes it, and the component's own documentation page documents
`icon` and `maxItems`. `data-display.ts` now re-exports the one authority.

**What changes for a consumer.** The `@object-ui/types/data-display` subpath is published, so
its `BreadcrumbItem` / `BreadcrumbSchema` and the `DataDisplaySchema` union's breadcrumb
member widen to the navigation declaration — they gain the four keys above. Nothing narrows
and no key changes type, so every value that type-checked before still does; what the subpath
now declares is what the renderer already honoured and the docs already described. Graded
`minor` because a published `.d.ts` member changes shape, per this repo's version-alignment
rule (never `major`).

The three `KNOWN_COLLISIONS` lines came down in the same change; that baseline
(`scripts/__tests__/one-authority-per-exported-name-6273.test.ts`) is shrink-only and fails in
both directions, so converging without deleting them would have been red too. 43 entries → 40.
