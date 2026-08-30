---
---

Test-only change: 25 test files that partially mock `@object-ui/react` now inherit the
real export surface via `importOriginal` instead of hand-listing exports. No published
behaviour changes — no source file is touched, and no assertion was edited or deleted.

A hand-listed mock freezes its export surface at whatever the author typed that day, so
the next export any widely-imported module reads at module scope kills those files at
COLLECTION — zero failed assertions, the file's tests never run, and the red suite reads
like flake. Spreading the real module makes the mock a superset, so a transitive consumer
can never trip over an export the test never meant to replace.
