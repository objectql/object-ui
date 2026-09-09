---
---

Adds `scripts/tsconfig-test-parity-census.mjs` (`pnpm census:tsconfig-test-parity`) and
`docs/audits/2026-09-test-tsconfig-parity-census.md`, the measurement objectui#8714 asked
for: every workspace `tsconfig.test.json` resolved through TypeScript's own config
resolver and compared axis by axis, plus the two ambient-type routes that live in the test
sources rather than in any config.

Internal tooling and documentation only — no published package source, entry point or
publish-contract field is touched, so nothing releases from this change.
