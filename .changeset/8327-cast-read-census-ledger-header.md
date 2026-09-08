---
---

Record the `#6150` ledger's own blind spot in its header: the census it pins is
complete only for the un-cast `schema.KEY` spelling, and the cast-aware re-run
(objectui#8327) finds 112 `(schema as any).KEY` reads across 23 files that it
could never have seen. Comment only, in a test file; no package is released by
this change.
