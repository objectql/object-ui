---
"@object-ui/plugin-grid": patch
---

fix(grid): validate email format in the import preview (objectstack#3566)

The ImportWizard's per-cell `validateValue` did no format check for `email`
columns (it fell through to `default → true`), so an obviously-bad address —
e.g. a non-ASCII domain like `x@柴仟.com` — passed client validation (and the
server dry-run) and only failed at real-import time inside better-auth, giving
a jarring "passed validation, then failed" experience.

- Added `isPlausibleEmail`, a single-pass structural + ASCII check that mirrors
  the server's `isLikelyEmail`, so bad emails are flagged red in the preview
  step before submit. No regex backtracking (same ReDoS-safety as the server).
