---
'@object-ui/types': patch
---

**`@object-ui/types`' tests are type-checked, so the spec-derivation guards actually run (framework#4074).**

`spec-derived-unions.test.ts` exists to stop a spec-derived union from being
re-forked into a hand-written copy, and its header claimed the `satisfies` checks
in it "are the real enforcement". They were not. `tsconfig.json` excludes test
files — correctly, since it is the package build with `rootDir` / `composite` /
`declaration`, so tests would emit into dist — and no other `tsc` invocation read
them. Measured, not assumed: reverting `ActionParamFieldType` from the spec's
`FieldType` back to its old hand-written subset produced **zero** type errors.

It now produces `TS1360` on the `satisfies` line. Same for the sibling guards over
`ChartType`, `ReportType`, `ActionType` and `PageType`, which were equally inert —
the anti-regression mechanism left by #2944/#2901 was not running.

`packages/types/tsconfig.test.json` follows the shape the package already uses for
`tsconfig.examples.json`: a separate, emit-free project chained from `type-check`.
Kept separate rather than deleting the exclude so the BUILD stays honest — the
reexport guard's source scan needs `types: ["node"]`, and folding that into
`tsconfig.json` would let package source reference Node APIs and still compile, in
a package that ships to browsers.

Turning it on surfaced 39 pre-existing type errors in test files, all fixed here
except one declared gap:

- **`p2-spec-exports.test.ts`** imported eight `…Schema` names as types from
  `../index`. #2561 decision (a) removed those, and the sibling
  `spec-ui-schema-reexports.test.ts` asserts their absence — so this file
  contradicted its own guard for the whole interval. A type-only import of a
  nonexistent name erases at runtime, so the suite stayed green. Its minimal
  fixtures were also typed as parsed OUTPUT while being parse INPUT (these schemas
  `.default()` several fields); they now use `z.input<>`, the distinction spec
  draws itself with `ActionInput`. `operator: 'eq'` is likewise a legacy alias spec
  folds at parse time, valid as input and absent from the canonical output union.
- **`app-creation-types.test.ts` / `system-fields.test.ts`** imported the package
  by its own name. `turbo`'s `type-check` depends on `^build` (upstream only), so
  the package's own `dist` does not exist when it runs; they now use the relative
  import every sibling test uses.
- **`p1-spec-alignment.test.ts`** is excluded with a written reason, and is real
  debt rather than hygiene: all 14 of its errors sit in tests named
  "should accept &lt;shape&gt;" whose entire purpose is asserting the type accepts
  that shape, and the type rejects it. The clearest case —
  "should accept sharing in ObjectUI format `{ visibility, enabled }`" — describes
  a shape that IS handled, by `foldSharing` in core's `normalize-list-view.ts`, but
  only as untyped input (`normalizeListViewSchema<T>(schema: T): T`), so no type
  names it. Each site is a separate decision (widen the type so the claim becomes
  true, or drop the claim) and several touch the public surface, so they are
  tracked on framework#4074 instead of being silently rewritten here.

Only `packages/types` is converted. 28 other packages still exclude their tests
from type-checking, and 5 (`fields`, `cli`, `data-objectstack`, `plugin-charts`,
`plugin-editor`) already include them — this establishes the pattern for the rest
rather than sweeping them.
