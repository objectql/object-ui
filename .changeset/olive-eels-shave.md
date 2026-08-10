---
---

Test-only change to `@object-ui/plugin-charts`: `ObjectChart`'s category option-color
probe (`/api/v1/meta/dataset/*` and `/api/v1/meta/object/*`) is now answered by a
recording test double in the four suites that were escaping to the real network, and
its request shape and success path get their first coverage. No published behaviour
changes.
