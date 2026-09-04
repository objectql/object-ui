---
---

Test-only change in `@object-ui/components`: the skill-guide fence extractor in
`skill-guide-data-table-binding.test.tsx` now reads `jsonc` fences as well as
`json`, so retagging a comment-carrying guide example no longer hides it from
every assertion in that file. No published behaviour changes.
