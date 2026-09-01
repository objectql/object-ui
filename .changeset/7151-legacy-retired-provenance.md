---
---

Test-only change to `plugin-dashboard`'s legacy-retired suite; no published behaviour changes.

The two annotated `it.each` rows in `DashboardGridLayout.legacyRetired.test.tsx` introduced their literals with provenance comments naming a schema-catalog fixture. Both were true when written and were invalidated 66 minutes later by the catalog migration off the retired shape (objectui#4600). The annotations now state the measured history and say plainly that the rows no longer carry the independent-corpus property, and the relationship they assert is derived at test time from the fixture instead of restated in prose.
