---
---

Pin the test runner's timezone to UTC (objectui#8366). The date-face pin family
asserts literal LOCAL-date faces built from fixed UTC instants, so the suite was
green at exactly one offset and red on a contributor's laptop anywhere else.
Test infrastructure only; no package is released by this change.
