---
---

Test-only change: 11 `vi.mock` factories under `packages/app-shell` now inherit the real
`@object-ui/plugin-chatbot` export surface instead of hand-listing it, and that specifier
joins `COVERED_SPECIFIERS` in `scripts/check-vi-mock-inherit.mjs`. No published behaviour
changes — no product source and no `package.json` was touched.
