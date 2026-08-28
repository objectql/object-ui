---
---

Delete `apps/console/src/hooks/useBranding.ts`, a `@deprecated` wrapper with zero callers.

Nothing published changes. The console's npm tarball ships only `dist`, `plugin.*` and
`README.md` (`files` in `apps/console/package.json`) — `src` is never in it — and the
package's single `exports` entry resolves to `plugin.js`, which is compiled from
`plugin.ts` alone and imports nothing from `src`. With no importer anywhere in the repo,
the hook was also absent from the built SPA bundle. Empty frontmatter is therefore the
accurate declaration: a source deletion under a released package that releases nothing.
