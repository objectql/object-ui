---
---

Build tooling only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. No package `src/` is touched: `@object-ui/layout`'s `vite build`
now exits non-zero when the declaration step reports type errors, instead of printing them
and exiting 0 (objectui#5370). The typings and the JavaScript it emits are unchanged.
