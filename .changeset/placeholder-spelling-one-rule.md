---
---

Tooling and test-only (objectui#7310): the placeholder-spelling rule that
objectui#3512's gate and `check-i18n-call-site-keys.mjs` class 7 each carried a
copy of now lives once, in `scripts/placeholder-spelling.mjs`, which both
import. No published behaviour changes — `scripts/` ships in no package and
`packages/i18n`'s `__tests__/` is excluded from its build. The merged
implementation was proven byte-equivalent to both copies over a 23,420-input
corpus before either was deleted, and the gate's full output is unchanged.
