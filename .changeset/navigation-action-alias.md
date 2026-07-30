---
"@object-ui/types": minor
"@object-ui/core": minor
---

refactor(actions): `navigation` becomes a named alias of the spec's `url`, sharing one navigator (#2944)

The last open item of #2944: `ActionRunner` dispatched a seventh action type,
`navigation`, that `@objectstack/spec`'s `ActionType` does not contain. The issue
asked for a decision — promote it upstream or delete the case. Neither, as stated.

- **Promoting it is wrong.** The spec already has `url` for "go to a location",
  with `openIn` for the new-tab/same-tab choice. A seventh type would put a
  second spec name on one operation, which is the exact failure the #2901 audit
  is named after: *a second definition of the vocabulary exists, and the renderer
  is faithful to the wrong one*.
- **Deleting it is worse, because it is silent.** `{ type: 'navigation', to: … }`
  is authored today (`element:button` CTAs). Without the case the action falls
  through to `executeActionSchema`, which returns `{ success: true }` — a green
  toast that navigates nowhere. That is #2960's trap.

So it stays, but stops being dialect. `ObjectUiLocalActionType` /
`OBJECTUI_LOCAL_ACTION_TYPES` in `@object-ui/types` declare it as objectui's own
alias of `url` — the same treatment #2985 gave `PageVisualizationAlias` — and the
runner routes both names through one navigator.

**The alias had already drifted, which is the point.** `executeNavigation` was
quietly the weaker of the two implementations: no `${param.X}` / `${ctx.X}`
interpolation, `openIn` ignored, and no `/api/…` full-page short-circuit (the
redirect-dance case `url` exists to handle). An author who wrote
`{ type: 'navigation', to: '/x?p=${param.p}' }` shipped the literal `${param.p}`,
while the identical `url` action resolved it. Both names now behave identically;
`url` in turn gains `replace` pass-through, the one modifier only the alias had.

Additive only. `replace` is omitted from the `NavigationHandler` options object
when unset, so hosts see the option shape they already saw.

The new guard is structural rather than another assertion. The runner's built-in
dispatch is a table typed `Record<RunnableActionType, …>` instead of a `switch`,
so an `ActionType` the spec **adds** stops compiling until an executor exists for
it — the Tier-2 "validates at save, renders nothing at run time" failure (#2942)
becomes a build error for actions. `spec-derived-unions.test.ts` additionally
asserts `navigation` is *absent* from the spec enum, so the day it is adopted
upstream, the test fails and names the alias to retire.
