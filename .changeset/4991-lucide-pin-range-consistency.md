---
---

Test-only change to `packages/cli/src/__tests__/app-generator.test.ts`: the
`lucide-react` manifest pin, and the pre-fix reverse-verification's drift
check, no longer read an arbitrary member off `inRepoRangesOf(...)` without
first asserting the repo's in-repo declarations for that dependency actually
agree. No published behaviour changes.
