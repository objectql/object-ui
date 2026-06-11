---
"@object-ui/core": patch
---

Add `ComponentRegistry.unregister(type, namespace?)` — the inverse of
`register()`. Clears the namespaced key and the bare-name fallback (when it
still resolves to that registration) plus any matching lazy stub, and notifies
subscribers only when something was removed. Lets callers (and tests) restore
prior registry state cleanly.
