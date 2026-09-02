---
---

Test-only change to `zod-mirror-parity.test.ts`'s `SPEC_DERIVED_PAIRS` re-check: it now
reads `Spec…` references off the TypeScript AST instead of scanning raw text between
`export const` boundaries, so a token mentioned in a comment is no longer counted as a
reference and no longer misattributed to the neighbouring export (objectui#6705). The one
change under `packages/types/src/zod/` is a docstring: the wording PR #6704 had to contort
around the old scanner is restored, along with the removal of the trap comment that asked
the next editor to remember. No published behaviour changes — no runtime, type or schema
surface moves.
