---
---

Documentation only: re-fenced the 12 TypeScript blocks in `content/docs/layout/**` that were
fenced `plaintext`, so `check-doc-snippet-types` compiles them, and fixed the four blocks it
then reddened (a missing `AppShellBranding` import, three examples using components and values
they never imported, and two `AppShell` examples that passed no children). Lowered
`KNOWN_UNHIGHLIGHTED_TS_FENCES` by the three layout files in the same change. No published
behaviour changes.
