---
---

Point the two `@example` blocks that still taught `getDataConfig(schema)` at the
shared record-source producer `resolveRecordSourceConfig(schema)` from
`@object-ui/core` (objectui#7798): the `useNavigationOverlay` block in
`packages/react/src/hooks/useNavigationOverlay.ts` and the
`resolveRecordSourceObjectName` block in `packages/core/src/utils/record-source.ts`.

`getDataConfig` is exported by nothing. It survives only as a file-local wrapper in
`plugin-map` and `plugin-grid` — and both of those already delegate their ladder to
`resolveRecordSourceConfig`, keeping only the array shorthand above it — so a reader
outside those two files could not write the line either example taught: there was no
module to import it from. The examples now spell `dataConfig` the way the live call
sites spell it (`plugin-calendar`, `plugin-tree`), which is the same judgement PR #7797
applied to `navigation-overlay.tsx`: follow the live call sites, not another doc block.
The `useNavigationOverlay` example also names the import, so the line it teaches is
copyable as written.

Doc comments only; no published behaviour changes and no package is released by this
change, so the frontmatter is empty.
