---
---

Comment-only change to `app-shell`'s `runtime-config.ts`: the "Server-side" pointer block
now anchors on exported symbol + package (`RuntimeConfigPlugin` from
`@objectstack/cloud-connection`, `RuntimeConfigPlugin` from `@objectstack/objectos-runtime`,
`createStudioRuntimeConfigPlugin` from `@objectstack/service-cloud`) instead of file paths,
two of which had gone stale. No published behaviour changes.
