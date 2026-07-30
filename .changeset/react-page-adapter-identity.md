---
"@object-ui/components": patch
---

fix(sdui): the react page's "no adapter yet" fallback stops churning its provider context

Audit of the remaining half of `ReactKindPage`'s scope memo, `[schema, adapter]`.
The `schema` half was the live bug fixed in objectui#2984; this is the adapter
half.

**The hosts are fine.** Both `AdapterCtx.Provider` call sites pass a stable
value — `AdapterProvider` from `useState`, the console preview from a module
constant — so there is no state loss in the shipped app.

**One real instance remained**, one layer down: `<SchemaRendererProvider
dataSource={adapter ?? {}}>` minted a fresh object on every render while the
adapter was still null (the window before the host connects). That is a context
value, and `SchemaRendererProvider` memoises on its identity, so every block
inside the page had its schema re-cloned and its expressions re-run on each
render of the page. Now a module constant, like the `SchemaRenderer` fallback
it mirrors.

**The `adapter` dependency itself must stay**, and is now pinned. It looks like
the obvious thing to optimise away — it is the last remaining trigger that can
recompile a page and cost its `useState`. But `ReactRunner` hands React the same
element object while `(code, scope)` hold, and React bails out on an identical
element reference, so the page subtree never re-renders on its own: recompiling
is the *only* path by which a new adapter reaches the blocks inside the page.
Removing the dependency strands every block on the first adapter forever — no
error, just a dead data source. `react-page-adapter.test.tsx` pins both
directions, so the tradeoff cannot be quietly re-litigated.

Docs: the react-pages guide now states the host-side requirement — an adapter
constructed inline on every render resets every react page on every render.
