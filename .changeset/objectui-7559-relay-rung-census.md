---
---

Internal, no published behaviour change: the object page's list relay
(`app-shell`'s `views/ObjectView.tsx`) gains a standing census
(`ObjectView.relayRungCensus-7559.test.ts`, objectui#7559) that re-derives the
`ListViewSchema` member set at test time and requires every member to have
either a rung in the relay or a declared absence with a reason. The only source
edits are comments and a type-only read at the `tree` block (`TreeViewConfig`),
which compiles away.
