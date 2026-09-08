---
---

The network-escape guard's `afterEach` is now registered per test file in the
`unit` project (`isolate: false`) instead of once per worker, so an escape in
any file is red, not only one in the worker's first file (objectui#8537).
Test harness only; no package is released by this change.
