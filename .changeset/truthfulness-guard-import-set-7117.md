---
---

Test-only change (objectui#7117): `exclusion-reason-truthfulness.test.ts` now imports the six `views/*-renderer.tsx` leaves and `@object-ui/plugin-detail`, so the three `PALETTE_EXCLUSIONS` keys that have a renderer outside the old import set (`app:launcher`, `global:notifications`, `record:chatter`) are actually visible to the guard, and a new renderer leaf that is not imported reds the suite instead of shrinking its coverage silently. No published behaviour changes.
