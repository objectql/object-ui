---
---

Test-only change to `@object-ui/plugin-dashboard`: its 47 test files are now
type-checked by a `tsconfig.test.json` chained off `type-check`, and the type
errors that surfaced were fixed in the tests (mock call signatures, one
`vi.importActual` cast, two filter fixtures re-spelled to the spec's option pair
form). No published behaviour changes — no source file was touched.

This also removes the last `TEST_DEBT` row from
`scripts/check-type-check-coverage.mjs`, closing the objectui#4040 program.
