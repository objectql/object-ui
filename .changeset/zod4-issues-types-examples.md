---
"@object-ui/types": patch
---

fix(types): zod-validation example and zod README teach the Zod 4 `.issues` accessor, and `examples/` is now type-checked

`ZodError.errors` was removed in Zod 4 (the repo is on 4.4.3). The
`packages/types/examples/zod-validation-example.ts` documentation example read
`.errors` in seven places, so every `console.error` printed `undefined` and the
last one — `invalidButtonResult.error.errors.length` — threw
`TypeError: Cannot read properties of undefined (reading 'length')`, killing the
example before its summary. Same bug, same cause as the `objectui validate` fix
in #2919; now reads `.issues`.

`src/zod/README.md` documented the same dead accessor plus a Zod 3 issue shape
(`code: 'invalid_enum_value'`, `"Invalid enum value. Expected …"`). Both were
corrected against what 4.4.3 actually emits: `code: 'invalid_value'` with a
`values` array and `'Invalid option: expected one of …'`.

**The example was invisible to CI, so the swap alone would let this rot again.**
`packages/types` type-checks with `tsc --noEmit` over a project whose `include`
is `["src/**/*"]` — `examples/` was outside it (the `"examples"` entry in
`exclude` was belt-and-braces; deleting it alone would have changed nothing).
Examples cannot simply join that project either: it is the package build
(`tsc` → `dist`) with `rootDir: "./src"`, `composite` and `declaration`, so
example files are both outside `rootDir` and would emit into `dist`.

Added `packages/types/tsconfig.examples.json` — an emit-free project covering
`examples/**/*.ts` — and chained it: `"type-check": "tsc --noEmit && tsc -p
tsconfig.examples.json"`. The example also now imports from `../src/zod/index.zod`
rather than `../dist/zod/index.zod.js`, matching its three sibling example files
(`dashboard.ts`, `login-form.ts`, `rest-data-source.ts`, all on `../src/index`)
so the check needs no prior build.

Verified the gate has teeth rather than trusting the green: restoring `.errors`
makes `tsc -p tsconfig.examples.json` fail with seven
`TS2339: Property 'errors' does not exist on type 'ZodError<…>'`. The example
also runs clean end-to-end again, printing `Expected validation errors: 2`
where it previously threw.

No runtime or published-type change: `examples/` is not in the package's `files`.
