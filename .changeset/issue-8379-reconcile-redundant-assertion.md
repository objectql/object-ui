---
---

Internal type-only change in `@object-ui/app-shell`: `useReconcileOnError` no longer asserts `ui as unknown[]` when handing the rehydrated thread to `setMessages`. `toUIMessages` already returns an array, which widens to the sink's `unknown[]` on its own, so the assertion converted nothing. Measured: the emitted JavaScript is byte-identical with and without it, so nothing is published and no consumer can observe this.
