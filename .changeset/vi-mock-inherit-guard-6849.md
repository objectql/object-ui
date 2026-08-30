---
---

Test/tooling only; nothing published changes.

Adds `scripts/check-vi-mock-inherit.mjs`, a ratchet that rejects a `vi.mock` factory
which hand-lists the exports of a covered workspace specifier instead of inheriting the
real module's export surface. The only `src/` file it touches is a plugin-view test
file, converted to the inheriting form — no runtime behaviour, no public API, no
published output changes.
