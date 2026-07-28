---
"@object-ui/plugin-grid": patch
"@object-ui/plugin-form": patch
"@object-ui/plugin-designer": patch
"@object-ui/cli": patch
"object-ui": patch
---

fix(plugin-grid,plugin-form,plugin-designer,cli,vscode-extension): type-check the last five unchecked packages, and fix the two runtime bugs that hid there (#2919)

Closes the remaining `DEBT` entries from the #2911 sweep. Each package gains
`"type-check": "tsc --noEmit"` and loses its entry in
`scripts/check-type-check-coverage.mjs`; coverage goes 36 -> 41 of 45 and
outstanding errors 25 -> 5 (only #2916 `plugin-view` and #2918 `layout` remain).

**Two of these were real bugs, not just type noise.**

`@object-ui/cli` — `objectui validate` could never report a validation failure.
`ZodError.errors` was removed in Zod 4 (the repo is on 4.4.3), so `.errors` read
`undefined` and `.forEach` threw a `TypeError` that the enclosing `catch`
reported as `✗ Error reading or parsing schema file: Cannot read properties of
undefined` — swallowing the very errors the command exists to print. Now reads
`.issues`. Verified against the built CLI: an invalid schema now prints
`1. Invalid input / Code: invalid_union` and exits 1.

`@object-ui/plugin-grid` — grouping a grid by a boolean column showed the raw
i18n key. `t('grid.booleanTrue', 'Yes')` asked for a key present in neither
`GRID_DEFAULT_TRANSLATIONS` nor any locale bundle, and passed the English
fallback as a bare second argument — which `createSafeTranslation`'s no-provider
translator reads as an *options object*, so the fallback never applied and the
header rendered the literal `grid.booleanTrue`. Switched to the `grid.yes` /
`grid.no` keys the boolean cell renderer (`ObjectGrid.tsx`) and
`BulkActionDialog` already use, with the fallback passed as `defaultValue`.
Covered by a new regression test, confirmed to fail against the old code.

The rest are type-only corrections that preserve runtime behaviour exactly:

- **plugin-grid** `importParsers.ts` — `scorePair`'s `score`/`reason` moved into
  one `best` record. They were captured `let`s mutated only inside the `bump`
  closure, which TypeScript's control-flow analysis does not track, so it still
  believed `reason` was `'none'` at the type gate and flagged the comparisons as
  non-overlapping (TS2367). The gate — which stops a text column being mapped
  onto a number field — is unchanged; its two dedicated tests still pass.
- **plugin-form** — `SectionFieldsContext.fieldLabel` now requires `fallback`,
  matching the `useSafeFieldLabel` producer in `@object-ui/i18n` (an omitted
  fallback could not satisfy the `=> string` return, and all four call sites
  already pass one). This one signature cleared six errors.
  `MasterDetailFormSchema.recordId` widens to `string | number`, matching
  `ObjectFormSchema` and the five envelopes that forward straight into it;
  it is narrowed with `String()` only at the batch-transaction boundary, whose
  `BatchTransactionOperation.id` is a string by protocol (the `isEdit` guard
  already proves it non-null there). `deriveMasterDetail`'s column sort gets an
  explicit `fillPriority` helper — `GridColumn.type` is optional, and a column
  without one keeps sorting at priority 5 exactly as the old
  `TYPE_FILL_PRIORITY[undefined] ?? 5` lookup put it.
- **plugin-designer** — unused `index` parameter prefixed `_`, matching the
  `_entry` beside it.
- **cli** — a stale `@ts-expect-error` removed; `viteConfig` is typed `any`, so
  the line it guarded had stopped erroring.
- **vscode-extension** (`object-ui`) — migrated off `moduleResolution: "node"`,
  which is deprecated and stops working in TypeScript 7, to `node16` paired with
  `module: "node16"` (the package has no `"type": "module"`, so node16 resolves
  it as the CommonJS that tsup emits, and it gains the `exports`-map awareness
  node10 lacks). Its error count was under-reported as 1: that TS5107 config
  error masked four more. The package uses `console`/`Buffer` but sets
  `lib: ["ES2020"]` with no DOM and never declared `@types/node` — added, with an
  explicit `types: ["node", "vscode"]`.

Also: `plugin-grid`, `plugin-form` and `plugin-designer` gain the `baseUrl` +
`paths` override their type-checked plugin peers already carry, and `cli` an
empty `paths`. Without it the inherited root `paths` point `@object-ui/*` at
sibling `src/`, which is outside each project's `rootDir` and produces the ~104
spurious TS6059 errors noted in #2915; workspace deps instead resolve through
node_modules to built `.d.ts`, which `type-check`'s `dependsOn: ["^build"]`
guarantees exist.

Verified the gate genuinely covers all five rather than trusting the green:
injecting a type error into each package makes `pnpm type-check --filter <pkg>`
fail, which was impossible before this change.
