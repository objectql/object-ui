---
---

chore(components): `@object-ui/components` type-checks its whole test tree.

No published code moves. The package gains a `tsconfig.test.json` chained from
`type-check`, its 34 code-tier test errors are fixed in the tests themselves,
and the narrow `tsconfig.typetests.json` — the rescue hatch for a package still
in `TEST_DEBT` — is retired now that the full project compiles the same file
(objectui#4040 tranche 4, under objectui#4291's ratchet). The remaining
`TEST_DEBT` counts for `core` and `app-shell` are corrected to the tranche-4
remeasurement.
