---
'@object-ui/core': patch
---

`cloneAsOverride()` now returns `DeepMutable<T>`, so a Tenant/User override draft type-checks as the mutable value it has always been.

`cloneAsOverride<T>(view: T): T` handed the input type straight back. Cloning a
`SystemView<S>` — which is `DeepReadonly<S>` plus the marker symbol — therefore
returned something still typed deep-readonly, even though the implementation has
always produced a plain mutable object (`structuredClone`, or a JSON round-trip
fallback) and deliberately drops the marker. The declaration was simply wrong
about its own value, and the documented override flow was the thing that broke:

```ts
const draft = cloneAsOverride(userListView)
draft.columns.push({ name: 'name' })   // TS2339 before this change
```

That is `packages/core/README.md`'s override example, and it failed to compile
against the built types — measured by the doc-snippet compile gate, which reads
`dist/*.d.ts` rather than source. The neighbouring line one block up,
`userListView.columns.push(...) // ❌ TypeError (strict mode)`, is the opposite
demonstration and correctly still fails; only the draft line changes colour.

The fix adds `DeepMutable<T>`, the inverse of the `DeepReadonly<T>` that
`SystemView` is built from, and returns it. Per the maintainer's 2026-08-19
ruling (option A on objectui#5257), the alternatives were rejected by name:
teaching a cast in the README is the lenient-consumer pattern the contract rules
out, and declaring the block a documentation fragment hides a real signature
defect behind the fragment marker.

Why this is a patch and not a break: the return type relaxes TOWARD what the
runtime already does, never away from it. A caller gains permission to mutate;
nobody loses one. `DeepMutable<S>` stays assignable everywhere `DeepReadonly<S>`
or `SystemView<S>` was expected, so a caller who fed a draft back into a
deep-readonly position still compiles — both directions are pinned as type-level
cases in `freeze-schema.types.test.ts`. A repo-wide sweep found no call site at
all outside the README, so nothing in this workspace needed changing.

Two limits of `DeepMutable`, stated rather than discovered later. It is
symmetric with `DeepReadonly` arm for arm, which means it inherits the same
tuple behaviour: a tuple widens to an array, exactly as `DeepReadonly` widens it
in the other direction. And it does not remove the `SYSTEM_VIEW_MARKER` key —
the clone never carries the symbol at runtime, but the key is declared optional,
so keeping it states "may be absent", which is true. Excluding it would require
a non-homomorphic mapped type that drops the `?` modifier from every other
property and turns optional keys required — a strictly worse type traded for
removing a key that already reads as optional.
