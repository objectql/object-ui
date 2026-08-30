---
---

examples(schema-catalog): the `components-complex-scroll-area` demos and
`sidebar-with-badges` author the key their own renderer reads — `children` for
`ui:scroll-area` (7 nodes, the whole category) and `label` for `ui:badge`
(2 nodes). Adds a per-renderer corpus sweep so the next demo authoring a
phantom key fails at review rather than shipping as an empty box.

No release: the only package touched is `@object-ui/example-schema-catalog`,
which `.changeset/config.json` ignores, plus its test folder. Declared
explicitly rather than omitted (objectui#3387) — `check-changeset-presence.mjs`
agrees nothing is owed, and this states why.
