---
---

Tooling-only fix (objectui#6313): `QUICK_REFERENCE.md`'s "Current Release" pin
(`scripts/__tests__/quick-reference-current-release-4143.test.ts`) and the sync
generator (`scripts/sync-quick-reference-release.mjs`) derived the Node/pnpm
version floors with `match(/(\d+)/)?.[1]`, which keeps only the LEADING integer
group. Against root `engines.node: ">=22.11"` (objectui#5306 / PR #6311) that
produced a floor of `22`, silently discarding the `.11` — so a row reading
exactly `≥ 22` passed a pin whose whole premise is disagreeing with its own
cited anchor. Both derivations now strip the comparator and keep the WHOLE
version string; `pnpm quick-reference:sync` regenerated the Node.js row to
`≥ 22.11`. Added regression coverage pinning that a `≥ 22`-shaped row is now
rejected and that a `≥ 220`-shaped row still is (objectui#4913), and corrected
the test file's docblock, which had gone stale on the same anchor one decimal
place up. No published package source changed.
