---
---

Test-only change: `ObjectView`'s two `contractEnvelope` pins (objectui#6726, objectui#6840) now assert on `deliveredThrough(asData)` directly instead of calling it from inside a `waitFor` predicate, and the helper waits on `find()`'s own settled answer before reading the last delivery. No published behaviour changes.
