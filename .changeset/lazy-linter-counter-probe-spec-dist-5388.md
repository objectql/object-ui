---
---

Build-config only: `apps/console`'s `assert-lazy-linter-stays-lazy` guard now takes its
`@objectstack/spec` module-id test as a parameter and is handed the injection-aware one
that `resolveSpecDistInjection` already publishes — the same value the
`vendor-objectstack` chunk group has always read. Under `OBJECTSTACK_SPEC_DIST` all 18
spec specifiers resolve to absolute paths in the overriding tree, which carry no
`@objectstack` segment, so the guard's own private regex matched zero modules, its
counter-probe correctly refused a verdict, and every console build made with the override
set died in `generateBundle` (objectui#5388, measured from the framework side in
objectstack#10136). The linter half keeps its literal regex and gains a counter-probe of
its own, because a blind `LINT` fails silently where a blind `SPEC` fails loudly.

Nothing publishes. `@object-ui/console` is NOT a private package — it is published, part
of the 40-package fixed group, and ships its built `dist/` — but this change touches only
`vite.config.ts` and repo tooling, neither of which is in its `files` list, and the
emitted bundle is byte-for-byte what it was: with the override unset the guard evaluates
the identical regex it did before.
