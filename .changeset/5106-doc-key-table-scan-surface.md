---
---

Tooling only, no published surface. `scripts/check-doc-component-types.mjs` now
reads the plugin KEY TABLES in `content/docs/**` — the canonical
`| Namespaced key | Bare-name fallback | Renderer behind it |` form the
objectui#5002 family standardised on — and judges both halves of every row,
including the namespaced one the gate never judged at all. Also fixes a floor
that named a counter which never existed (`docFiles`), so the check that catches
the docs walk finding nothing had been inert, and adds a guard that makes the
same mis-key fail loudly instead of silently passing.
