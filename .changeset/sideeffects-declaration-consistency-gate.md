---
---

Test-only (objectui#3943). A repo-level gate now holds every workspace package's
`sideEffects` declaration to what its modules actually do at load time —
`scripts/__tests__/side-effects-declaration-consistency.test.ts`, in the shape
`package-files-exist.test.ts` established for `files`.

`sideEffects: false` is a promise to bundlers that no module does anything on
evaluation. When it is false, a bundler drops the module whole: 0 bytes, exit
code 0, no warning, and the failure surfaces far away as a red
`Unknown component type` panel. objectui#3899 was that defect in
`packages/layout`; PR #3940 fixed it and pinned it, but the pin only ever read
`packages/layout/package.json`, so the next package to repeat it would turn
nothing red.

The gate checks both directions — a `false` package must have no load-time side
effect anywhere in its barrel's reachable module graph, and every entry in a
`sideEffects` array must name a real module form that really does have one. Entry
forms are derived from `main`/`module`/`exports` **and** from the in-repo bundler
alias tables, because a package aliased at its `src` is bundled through the same
manifest (PR #3940 measured a 0-byte console bundle with only the `dist/*` paths
declared). Every probe runs against a real bundler and carries its
`sideEffects: false` control, so a bundler that stopped honouring the field fails
loudly instead of leaving the gate green over nothing.

`packages/layout/src/__tests__/side-effects-manifest.test.ts` is converged into
the new gate: everything in it is now derived for all packages, except the
assertion that layout's actual registry keys survive a side-effect-only import,
which is carried over as the gate's named specimen.

No published behaviour changes — no package's runtime source was touched.
