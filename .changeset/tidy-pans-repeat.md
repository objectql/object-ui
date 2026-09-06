---
---

Tests only (objectui#7234): pin that an object-declared `list_toolbar` action
reaches the DOM from the served `/meta/object` payload, and that ADR-0066 D4's
`requiredPermissions` capability gate — not the relay — is what hides a
declared-but-ungranted action at every location. No runtime behaviour changes,
so nothing is released.
