---
---

Gate the metadata-admin designer's own string tables (objectui#8834). Tooling and CI
only; no package is released by this change.

`packages/app-shell/src/views/metadata-admin/i18n.ts` carries the Studio designer's
module-local string tables, and nothing checked that the two halves of a pair follow each
other: `check:i18n-keys` skips the module by declaration, `check:i18n-drift` read only the
ten locale packs, and the dead-keys sweep asks about dead keys over the union of both
halves — so a one-sided key was not a subject to it. Adding an English string and
forgetting the Chinese one was green everywhere.

Three legs land, each in the mechanism that owns it:

- `check:i18n-designer-parity` (new script, new `ci.yml` step) enforces `en` as a subset
  of `zh` and placeholder parity over the shared rows, for three table pairs. `zh`-only
  keys are REPORTED with three documented families subtracted, never gated — the enforced
  half arrives green with an empty exemption ledger.
- `check:i18n-drift` gains the table as a second population, so a changed `en` value whose
  `zh` row did not follow is named. That is the defect the card opens with.
- `collectDesignerKeys` learns to read supplied source text, a caller-chosen table list and
  values, so all three legs share ONE extractor rather than growing a second copy of it.
