---
---

Docs-site host and catalog test only: `apps/site/app/components/registerCatalogBlocks.ts`
now declares `@object-ui/plugin-grid` instead of inheriting `object-grid` from
`@object-ui/plugin-view`'s `import { ObjectGrid }` (`ObjectView.tsx:37`). Nothing renders
differently — measured: with exactly the eleven packages the host used to carry,
`object-grid` and every `@object-ui/plugin-form` key already resolved — which is the point.
A component import in another package was the only reason two catalog tiles could draw, and
a refactor of `object-view` that stopped it from drawing a grid itself would have turned
them into OBJUI-001 panels with the cause several files from the symptom.

`catalog-gallery-render.test.tsx` gains the judge that can tell the two apart: every
`plugin-*` category with catalog entries must be loaded BY NAME in the host's import list,
derived from the categories rather than enumerated, and leaning on the existing parity case
that ties `HOST_PACKAGES` to the host file's literal imports. `ComponentRegistry.get()`
cannot judge this — it is truthy in both worlds.
