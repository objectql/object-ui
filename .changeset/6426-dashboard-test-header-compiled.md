---
---

Comment-only fix: two headers in `@object-ui/plugin-dashboard` still said this
package's tests are "compiled by nothing", a debt that has since been paid. The
paragraphs did not merely describe the old state — they prescribed against
writing a compile-time pin in this package, and nearly misrouted the legitimate
one that objectui#6373 landed a few files away.

- `src/__tests__/MetricWidget.domPassthrough.test.tsx` — the header claimed
  `tsconfig.json` excludes the tests, that the package is "the sole remaining
  `TEST_DEBT` entry", and that a `@ts-expect-error` written there "would be
  especially dishonest".
- `src/domPassthroughPins.ts` — the counterpart half of the same contract
  carried the same premise (plus a stale "6 errors, objectui#4118" count), so
  fixing only the test file would have left the two halves disagreeing.

Both now state today's arrangement and name the config that does it:
`tsconfig.test.json` type-checks this package's tests, chained from the
package's `type-check` script (`tsc --noEmit && tsc -p tsconfig.test.json`).
The `src/` placement of the pins is kept and re-framed as a preference rather
than a constraint — they still belong next to the contract and still emit zero
runtime bytes, but a pin in a test file is checked now too.

Measured on this tree: `tsconfig.test.json --listFiles` includes 81 of this
package's test files (both edited-adjacent files among them);
`node scripts/check-type-check-coverage.mjs` reports `test type-check coverage:
41/41 packages compile their tests, 0 declared debt`; and an `@ts-expect-error`
injected into the test file guarding nothing is reported as
`error TS2578: Unused '@ts-expect-error' directive`.

No behaviour change, no public surface change.
