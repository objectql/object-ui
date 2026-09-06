---
---

Comment-only change to `@object-ui/create-plugin`: `src/templates.ts` gains a docblock
note recording that scaffolding into this monorepo is already refused by named pins
(objectui#7524), and that the emitted per-package `test` block stays correct for the
generator's actual audience. No generated file changes, so nothing is published.
