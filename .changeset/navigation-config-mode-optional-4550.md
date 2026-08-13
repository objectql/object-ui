---
'@object-ui/react': minor
'@object-ui/plugin-list': patch
---

`NavigationConfig.mode` is optional — the type now says what the hook does

`@object-ui/react` published a `NavigationConfig` that required `mode`, in front of a `useNavigationOverlay` that has always defaulted it. The declaration took the spec's authored config, `Omit`ted `mode`, and re-added it as `NonNullable< … >`; 140 lines below, the hook read `navigation?.mode ?? 'page'`. The type was strictly stricter than the implementation it fronted, and `'page'` is meaningful behaviour rather than a placeholder.

The spec never asked for that. `NavigationConfigSchema` declares `mode: NavigationModeSchema.default('page')`, and a `.default()` lands on the authoring side as `| undefined` — so `navigation: { view: 'summary_view' }` is legal authored metadata that lets the mode default. `@object-ui/types` already re-exported the spec's own `NavigationConfig` unchanged, which meant one monorepo shipped two published types of the same name that disagreed about whether `mode` could be omitted.

The alias is now the spec's authored config verbatim, with no divergence of its own:

```ts
export type NavigationConfig = SpecAuthoredInput< typeof NavigationConfigSchema >;
```

The cost of the old spelling was paid by callers. `ListView` carried `schema.navigation as NavigationConfig | undefined` for no reason except to get a valid spec-shaped value past the declaration; that assertion is deleted here, not replaced. A type in front of an implementation must not be stricter than the implementation — when it is, every caller pays in casts, and a cast is exactly the renderer-side workaround that belongs back at the producer.

**Nothing changes at runtime.** `navigation?.mode ?? 'page'` is untouched, and the default is now pinned as observable behaviour (`useNavigationOverlay.modeDefault.test.tsx`) rather than only as a comment — the explicit modes, the `preventNavigation` and `none` short-circuits, the `onRowClick` priority, and the Cmd/Ctrl/middle-click and `new_window` branches are all pinned alongside it.

**Why minor rather than patch**, from the measured `.d.ts`. Optional-izing a property is looser for writers and narrower for readers, so the grade turns on which role the published surface actually plays. In this package `NavigationConfig` occurs only in input positions — `useNavigationOverlay`'s `navigation?:` option and `resolveOverlayWidth`'s parameter — and never in a return type; the package consumes these values and never hands one back. For consumers the change is therefore purely permissive: every call that compiled before still compiles, and spec-shaped configs that previously needed an assertion now compile without one. That gained input shape is a real capability rather than an internal repair, which is more than a patch describes. The reader-side narrowing is real but secondary: code that imports the bare type, annotates its own value with it and reads `.mode` now sees `NavigationMode | undefined`. The in-repo census found exactly one such importer — `ListView` — and it imported the type only to write the assertion this change removes.
