---
"@object-ui/app-shell": patch
---

ADR-0048 (#1824): the Studio metadata editor's post-save refresh now scopes its
layered + draft re-read to the same package as the initial load (`?package=`), so
when two installed packages ship the same `type`/`name` the editor re-reads
this package's own row after saving — not another package's. The save itself
already binds the package; this aligns the refresh with it.
