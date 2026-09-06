---
---

Build orchestration only; no published behaviour changes.

`@object-ui/components` and `@object-ui/site` each carried a hand-written
`prebuild` (and, for components, a `pretest` pointing at it) that listed the
workspace packages their build needed. That list is a second, unchecked copy of
the package's own `dependencies`, and the components one had drifted: it named
three packages while the closure turbo derives is seven, so
`pnpm --filter @object-ui/components build` failed inside `@object-ui/react` on
any tree where `@object-ui/i18n` and `@object-ui/data-objectstack` were not
already built. Both hooks are deleted; turbo's `build.dependsOn: ["^build"]` is
now the single source of build order, as it already was for every path CI takes.

Trade-off, recorded here rather than left implicit: the bare per-package forms
`pnpm --filter @object-ui/components build` and `pnpm --filter @object-ui/components test`
no longer build their upstream packages first. They were never a supported entry
point on a clean tree — that is the defect this removes, not a capability it
takes away — but on a warm tree they used to be self-sufficient and now are not.
The supported forms are `turbo run build --filter=@object-ui/components` and
`turbo run test --filter=@object-ui/components` (turbo's `test` task also
declares `dependsOn: ["^build"]`), plus the repo-root `pnpm test`. Every
in-repo document and hint string that taught the direct form now teaches the
turbo form, and the root `site:build` script goes through turbo, matching what
CI already ran.
