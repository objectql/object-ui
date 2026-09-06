---
---

Test-only: three `vi.mock` factories now inherit the real export surface of `@object-ui/plugin-markdown`, `@object-ui/data-objectstack` and `@object-ui/plugin-report` instead of hand-listing it, and those three specifiers join `check-vi-mock-inherit`'s covered set. No published behaviour changes.
