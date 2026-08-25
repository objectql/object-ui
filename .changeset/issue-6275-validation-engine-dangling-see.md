---
---

Comment-only change in `@object-ui/core`: the `SimpleExpressionEvaluator` doc block
no longer points at the deleted `SECURITY_FIX_SUMMARY.md`, and states the security
rationale inline instead. Releases nothing — the class is not exported, so the doc
block reaches no `.d.ts`, and no behaviour, type or API surface changes.
