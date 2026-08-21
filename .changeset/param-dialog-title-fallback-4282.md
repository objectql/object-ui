---
'@object-ui/app-shell': patch
---

The console's param-collection dialog now titles itself from `action.label` alone —
the unreachable `|| action?.title` fallback beside it is removed (objectui#4282).

`title` is declared on no action surface in the ecosystem: it is absent from
`@objectstack/spec`'s `ActionSchema` (44 keys walked at spec 17.0.0), from
`@object-ui/core`'s `ActionDef` and its pinned `ACTION_DEF_KEYS` / `SPEC_ACTION_KEYS`
inventories, and from `@object-ui/types`' renderer view (`ui-action.ts`) and `crud.ts`
`ActionSchema` / `BaseSchema`. None of the four action renderers — `action:button`,
`action:icon`, `action:group`, `action:menu` — forwards it either. So the right-hand
side of that `||` could not be reached by authored metadata: a fallback that cannot
fire, which is the "declared is not enforced" shape objectstack#4075 exists to reduce.
Nothing a user hits changes; the line now reads exactly one key, matching the
`description` line directly below it.

`useConsoleActionRuntime.paramDialogTitle.test.tsx` pins the reader so the alias cannot
be reinstated silently: an action carrying `title` and no `label` must open an untitled
dialog rather than a dialog named by a key no producer sets.
