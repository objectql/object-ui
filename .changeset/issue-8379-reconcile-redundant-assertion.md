---
---

Internal type-only change in `@object-ui/app-shell`: `useReconcileOnError` no longer asserts `ui as unknown[]` when handing the rehydrated thread to `setMessages`. `toUIMessages` already returns an array, which widens to the sink's `unknown[]` parameter on its own, so the assertion converted nothing.

Measured against the base commit with two real package builds: the published `.d.ts` is byte-identical, and the published `.js` differs only by the four explanatory comment lines this change adds -- there is no code delta (with comments stripped both emits are 1584 bytes and identical). Nothing a consumer of the tarball can observe changes, so this declares no release.
