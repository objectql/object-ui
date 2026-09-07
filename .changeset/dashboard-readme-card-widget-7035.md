---
---

Docs + test only, releases nothing.

`packages/plugin-dashboard/README.md`'s "Dashboard with Charts" example taught two
widgets spelled `type: 'card'` with a nested `body`. `'card'` is not a member of the
widget vocabulary objectui#4600 closed, so the whole document was refused by
`@object-ui/types/zod`'s `DashboardComponentSchema` — measured, not assumed. They are
now the chart-family widgets the renderer actually dispatches (`line` / `pie` with
inline rows under `options.data`), and a new test parses every dashboard example on
that page through the shipped schema so the shape cannot come back unnoticed.

No package source changed; the new file is a test.
