---
---

Finish the `@object-ui/i18n` slice of the `check-vi-mock-inherit` ratchet: the
last frozen factory (`DeclaredActionsBar.test.tsx`) obtains and spreads the real
module, and the specifier joins `COVERED_SPECIFIERS`, so the gate now holds the
population at zero instead of a pin file doing it by hand (objectui#7337). Test
and CI-script only; no published behaviour changes and no package is released by
this change.
