---
"@object-ui/types": minor
"@object-ui/layout": patch
"@object-ui/plugin-designer": patch
"@object-ui/i18n": patch
---

fix(types,layout): nav item type `component` joins `NavigationItemType` and its zod enum — objectui#2918

The renderers have carried a full `type: 'component'` implementation (Phase 3b:
`componentRef` colon-split to `/component/<ns>/<name>`, `params` serialised as
querystring, `metadata:*` special-cases) — but the vocabulary never gained the
member, and `@objectstack/spec` has had `ComponentNavItem` all along. The zod
enum was the part that bit: `NavigationItemTypeSchema` rejected
`type: 'component'` at validation time, so authors could not declare one and
the renderer half was unreachable — dead on arrival rather than dead code.

- `NavigationItemType` and `NavigationItemTypeSchema` gain `'component'`;
  `NavigationItem` gains the fields the renderer consumes, `componentRef` and
  `params` (also used by `type: 'page'`), mirroring spec's `ComponentNavItem` —
  declared in zod too, so parse no longer strips them.
- The `(item as any).componentRef` / `params` casts in `NavigationRenderer`
  and `AppSchemaRenderer` become typed access.
- `NavigationDesigner`'s exhaustive type-meta map gains a `component` badge
  (new `appDesigner.navTypeComponent` key in all 10 locales).
- `@object-ui/layout` gains `type-check` (src + tests) with the #2915 `paths`
  override; its DEBT entry in `check-type-check-coverage.mjs` is deleted.
