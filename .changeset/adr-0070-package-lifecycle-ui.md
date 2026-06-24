---
"@object-ui/app-shell": patch
---

feat(studio): package lifecycle UI — Duplicate base, Adopt loose items, structure-only delete (ADR-0070 D4/D5/D6)

`PackageDetailSheet` gains the user-facing affordances for the package-as-
lifecycle-unit work:
- **Duplicate** → `POST /packages/:id/duplicate` (clone a base into a new
  writable package; D4).
- **Adopt loose items** → `POST /packages/:id/adopt-orphans` (migrate every
  package-less orphan into this base; D5).
- **Delete** now asks whether to drop records too (`?keepData`) — structure-only
  vs everything (D4 Q3).

D6 guardrail test: the scope selector never defaults to the package-less
`Local / Custom` sentinel (`writableBaseOptions` excludes it; real bases sort
first).
