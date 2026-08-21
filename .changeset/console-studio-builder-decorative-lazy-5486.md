---
'@object-ui/console': patch
---

`registerStudioComponents.tsx` no longer claims a code split it never had: `studio:builder` imports `BuilderLanding` directly instead of through a `lazy()` that deferred nothing.

The registration wrapped `import('@object-ui/app-shell')` in `lazy()` behind a
`Suspense` fallback — naming the same barrel the line above it imports
statically for `registerAppComponent`, and the same barrel `App.tsx` pulls
`BuilderLanding` from to render the standalone `/studio` landing full-screen.
Either reason alone makes the `import()` unable to move a module into another
chunk (objectui#5486).

**This moves no modules and is not a bundle improvement.** `BuilderLanding` was
already in the eager graph via `App.tsx` and still is. Measured on
`dist/eager-closure.json`, both builds exiting 0: the eager closure holds the
same 52 chunks with the same names, and the only difference is 130 B gzipped
(413 B raw) off the entry chunk — the deleted `lazy()`, `Suspense` and fallback
text themselves, 0.003% of a 3,875 KB closure. Nothing leaves the closure,
because nothing could.

What it does fix is honesty. The old code told every reader the builder was
deferred, and it emitted an `INEFFECTIVE_DYNAMIC_IMPORT` warning on every
console build — the console's count of those drops from 44 to 43, with the 43
remaining ones all belonging to the `packages/fields` barrel (objectui#5325).
A permanent warning that fails nothing is how a team learns to skim past build
warnings, and a decorative `lazy()` is how the next reader learns something
false about the chunk graph.

The `lazy()` shape is not the mistake. The sibling `registerAccountComponents.tsx`
lazy-imports `./pages/system/ProfilePage`, a specifier nothing else pulls in
statically, and is genuinely deferred; it is untouched. Making the *builder*
genuinely lazy would mean taking `App.tsx` off the static import too, changing
how `/studio` mounts, and it only pays if app-shell's own graph cleaves behind
the barrel — a separate measured card, not folded in here.
