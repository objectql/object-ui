---
"@object-ui/runner": patch
---

fix(runner): type-check the package at all, and fix the `DataSource` contract violation that hid behind a broken import (#2917)

`@object-ui/runner` was the worst-covered package in the repo: `build` is
`vite build` (transpile only), it had no `type-check` script, and — uniquely —
**no `tsconfig.json` at all**. Nothing had ever type-checked it, despite it being
a published package.

**It was not broken at runtime.** The two bad imports were `import type`, so they
were erased before they could fail, and the one value import
(`emulateBatchTransaction`) does exist. `MockDataSource` is also unreferenced
anywhere in the repo. So this is a correctness and reference-quality fix, not an
outage.

**What the missing check actually hid.** `DataSource` and
`BatchTransactionOperation` were imported from `@object-ui/core`, which does not
export them — they live in `@object-ui/types`. Because that import never
resolved, `class MockDataSource implements DataSource` was silently a no-op, and
three separate commits maintained the class *as if* it were being verified
(`62b9ab510` added `batchTransaction`, `09d9669c7` made `getObjectSchema`
required, `5527388b0` added input validation). With the `implements` clause
inert, a real contract violation survived all three:

```ts
async find(resource: string, params?: any): Promise<any[]> { return []; }
```

`DataSource.find` returns a `QueryResult` envelope, not a bare array. Anyone
copying this mock as the starting point for their own adapter — which is exactly
what its doc comment invites — would hand every consumer an array where `.data`
and `.total` are `undefined`. Now typed as `Promise<QueryResult>` and returning
`{ data: [], total: 0 }`.

Also in this change:

- `packages/runner/tsconfig.json` added, mirroring `apps/console` rather than the
  library packages: `runner` is a Vite app, so it wants `bundler` resolution,
  `allowImportingTsExtensions` (for `./App.tsx`) and `types: ["vite/client"]`
  (for `import.meta.glob` in `MetadataLoader` and the `./index.css` side-effect
  import). Keeping it standalone instead of extending the root config also means
  it never inherits the root `paths`, so workspace deps resolve through built
  `.d.ts` and the TS6059 `rootDir` class of error cannot appear.
- unused parameters prefixed with `_` (6x in `mockDataSource`), and an unused
  `Circle` icon import dropped from `LayoutRenderer`.
- `"type-check": "tsc --noEmit"` added, and the package's `DEBT` entry deleted
  from `scripts/check-type-check-coverage.mjs`. Coverage goes 35 -> 36 of 45 and
  outstanding errors 46 -> 32.

Verified the gate genuinely covers the package now, rather than trusting the
green: injecting a type error into `runner/src/App.tsx` makes `pnpm type-check`
fail with `Failed: @object-ui/runner#type-check`, which was impossible before
this change.
