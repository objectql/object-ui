---
'@object-ui/app-shell': patch
---

`AppSidebar` is now `@deprecated` — use `UnifiedSidebar` instead.

A census (objectui#5720) found `AppSidebar` has no in-repo mount point
(`ConsoleLayout` renders `UnifiedSidebar`, not this component) and no
downstream consumer visible anywhere across this org's GitHub-visible
repositories. It stays exported — from the package barrel and the published
`dist/index.d.ts` — because `@object-ui/app-shell` is a public npm package
(`publishConfig.access: "public"`) and an external consumer outside this org
is structurally invisible to that census; that is why it is deprecated
rather than deleted outright. No behavior change in this release — the
component still renders exactly as before. Its admin nav cluster is a
near-duplicate of `UnifiedSidebar`'s and has already drifted from it (it
gates only `sys-marketplace` on the workspace-admin flag, where
`UnifiedSidebar` gates the whole cluster); that divergence is not being
reconciled, since the component is scheduled for removal rather than kept
in parity — see objectui#5817 for the removal plan.

Migration: replace any `AppSidebar` usage with `UnifiedSidebar` from the same
package.
