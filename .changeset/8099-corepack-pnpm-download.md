---
---

Route every workflow's pnpm bootstrap through `scripts/ci-setup-pnpm.sh`, which enables
Corepack and then downloads the pinned pnpm in a bounded, retried, self-describing step
(objectui#8099). A Corepack registry read dying inside undici had reddened the required
`README Export Check` ten seconds into a job, before any gate logic ran; on the
`merge_group` leg a required check that fails to report costs a 60-minute queue stall.
Applied to all 18 `corepack enable` sites across 13 workflows, with
`scripts/__tests__/ci-setup-pnpm-wiring.test.ts` holding the breadth. CI and docs only; no
package source changes and nothing is released by this change.
