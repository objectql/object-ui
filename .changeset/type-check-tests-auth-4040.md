---
---

Releases nothing on purpose: `@object-ui/auth` now type-checks its eleven test files
(`tsconfig.test.json` chained from `type-check`), and its `TEST_DEBT` entry is gone. Only
test sources changed; no published behaviour, and no public type, moved.

Both declared code-tier errors were real:

- `AuthProvider.test.tsx`'s `createMockClient` claimed to return an `AuthClient` while
  implementing 8 of its ~38 methods. The double is the right call — the provider only
  reaches those 8 on the paths under test — but the claim was not, and it is the exact
  thing an unchecked test hides. Asserted at the one seam with `as unknown as AuthClient`,
  which is what this package's three other mock-client factories already do.
- `createAuthClient.test.ts` had an unread `input` parameter on a `fetch` double
  (`TS6133`, from the repo's `noUnusedParameters`), renamed `_input`.
