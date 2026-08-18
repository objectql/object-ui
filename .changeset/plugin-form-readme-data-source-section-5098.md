---
'@object-ui/plugin-form': patch
---

`plugin-form` README: the "Integration with Data Sources" section now teaches the adapter's real path instead of two keys no form renderer reads.

The section taught backend wiring as two keys on a form schema — `dataSource`
(the adapter itself) and `resource: 'users'` — on an un-annotated
`const schema = { … }`. Neither key is read anywhere on either form route:

- **`dataSource`** is *discarded* by the basic form. The renderer reads its
  adapter off `SchemaRendererContext`
  (`packages/components/src/renderers/form/form.tsx:1004`) and passes it down per
  field (`:2061`); a same-named key arriving on the schema or props is dropped by
  the discard destructures at `form.tsx:304` and `:2168`, so it reaches neither a
  widget nor the DOM.
- **`resource`** is declared on neither `FormSchema` nor `ObjectFormSchema`. The
  key exists in the protocol, but on `CRUDSchema` (`packages/types/src/crud.ts`,
  `type: 'crud'`); no form renderer reads it under any spelling.

Both survived compilation because `FormSchema` and `ObjectFormSchema` extend
`BaseSchema`, which declares `[key: string]: any` — so an invented key is never a
type error, merely never read. A reader who copied the block got a form that did
not connect to a backend, with nothing reported: what appeared to work was the
hand-written `onSubmit` closure, which genuinely runs (the renderer awaits it at
`form.tsx:1428`) using the adapter its *closure* captured, entirely independently
of the two keys beside it.

The section is rewritten around the real mechanism: the adapter is injected once
by `SchemaRendererProvider` and travels on context, the metadata route uses
`object-form` with its required `objectName` + `mode`, and the TypeScript route
is a bare `form` whose `onSubmit` owns persistence. Both examples now carry real
type annotations (`ObjectFormSchema` / `FormSchema`) in line with the rest of the
file — an un-annotated object literal type-checks whatever is written in it. A
closing note records the one thing a top-level `dataSource` *does* mean on a
schema node: the spec's element binding (`{ object }`, objectstack#6953), which
explicitly rejects a live adapter (`element-data-source.ts:131` refuses any value
carrying a `find` method).

Documentation only — no source, type or behavior change. This also removes a
self-contradiction inside the same README, whose "Registering a component under
your own key" section already stated the rule correctly ("never a `dataSource` —
that travels on `SchemaRendererContext`").
