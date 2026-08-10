---
---

Test-only change to `@object-ui/plugin-detail`'s DetailView suites: the record-level
explain probe (`useRecordEditable`) is now answered by an injected test double instead
of escaping to the real network, and its request shape is asserted. No published
behaviour changes.
