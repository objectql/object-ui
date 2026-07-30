---
"@object-ui/core": patch
"@object-ui/react-runtime": patch
"@object-ui/components": patch
---

fix(sdui): lazily-registered public blocks reach a `kind:'react'` page's scope, and ReactRunner keeps the errors it catches

Two defects in the trusted `kind:'react'` page tier.

**objectui#2953 — the contract skipped lazy blocks.** `getPublicConfigs()`
resolved every curated `PUBLIC_BLOCKS` tag through `getConfig()`, which reads
loaded registrations only, so a block registered with `registerLazy()` was
absent from the contract until its plugin chunk happened to be imported. In
`apps/console` that silently dropped `object-kanban`, `object-calendar`,
`object-gantt`, `object-timeline`, `object-map` and `markdown` from every react
page's scope — writing `<ObjectKanban/>` threw `ReferenceError` even though the
tag is a first-class contract member, and whether it threw depended on load
order. `getPublicConfigs()` now resolves pending lazy stubs too, returning them
with `lazy: true` and no `component` (new `PublicComponentConfig` type); the
injected wrapper renders through `SchemaRenderer`, which triggers the loader and
shows its placeholder. `getConfig()` stays loaded-only by design.

**objectui#2954 — ReactRunner discarded its own error state.**
`getDerivedStateFromProps` re-transpiled and re-evaluated the page source on
every render and unconditionally set `error: null`. React runs it before the
re-render that follows `getDerivedStateFromError`, so the boundary threw away
the error it had just caught, rebuilt an identical throwing element, and the
throw escaped past its own `fallback` to the renderer's generic panel; `onError`
was gated on state that had already been cleared and never fired for a
compile-time error at all; and each compile minted a fresh page function — a new
element type — that remounted the subtree and wiped the page's `useState`. The
transpile+eval is now memoised on `(code, scope)`, errors persist until the
inputs actually change, and `onError` reports each error exactly once.
