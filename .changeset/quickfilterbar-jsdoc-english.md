---
---

Comment-only: `QuickFilterBar`'s JSDoc in `@object-ui/plugin-gantt` is now English
throughout (Commandment #-1 covers code comments, not just user-facing text), and each
`QuickFilterLabels` member points at the `gantt.quickFilter.*` bundle key the host
`ObjectGantt` resolves it from. The Chinese examples predated objectstack#5427 moving
those four strings into the bundle, so they no longer matched any call site's literal.
No behaviour change — no shipped code, type, or string was touched (objectui#4021).
