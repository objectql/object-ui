---
---

Releases nothing on purpose: `@object-ui/permissions` now type-checks its four test files
(`tsconfig.test.json` chained from `type-check`), and its `TEST_DEBT` entry is gone. Only
test sources changed; no published behaviour, and no public type, moved.

All five declared code-tier errors were the same `TS2741`: fixtures typed `RoleDefinition`
while omitting its required `permissions`. The empty array they gained is the accurate
value rather than padding — those roles grant nothing directly, and every grant the cases
exercise arrives through the `ObjectPermissionConfig[]` beside them, keyed by object.

A further 21 errors appeared first and were config-tier, not code: `TS2304` on the Node
`global` the two `MePermissionsProvider` suites stub `fetch` through, resolved by naming
`types: ["node"]` in the test project.
