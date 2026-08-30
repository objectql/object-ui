---
---

Build-tooling consolidation with no published bytes changed:
`packages/fields/scripts/build-css.mjs` no longer carries its own copy of the
components-sheet subtraction and now runs the shared
`scripts/build-plugin-stylesheet.mjs` builder that `@object-ui/plugin-grid` and
`@object-ui/plugin-kanban` already use (objectui#4929). One implementation of
the subtraction now exists, so a fix to it reaches every package that ships a
supplement stylesheet instead of only the one it was applied to.

Declared as **no release** deliberately. `@object-ui/fields` ships
`dist/index.css` to consumers, so the acceptance gate for this change was byte
identity of that artifact, not equivalent-looking code — and it holds: the
emitted sheet is `git hash-object f9cd6504a9e3a9603836230aea27c5a3a7e4e431`,
22761 bytes, `167 rules kept (163 classes)`, both before and after the rewrite,
and now from any working directory. Nothing a consumer installs changes, so
there is no behaviour to release; bumping the fixed group of packages for a
build script that emits identical bytes would put a version in the changelog
that describes nothing.

Fields keeps what is specific to it — its `MUST_SURVIVE` sentinels, its
`CLASS_CEILING` of 600 and its stylesheet banner, the last through a documented
`build({ header })` hook added to the shared module rather than a retained
second copy of the builder.
