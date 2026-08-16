---
---

Docs-only alignment plus its pin: `content/docs/layout/app-shell.mdx` now reprints all
seven props `AppShellProps` declares (adding `branding` and `rightRail`), and the existing
app-shell docs pin test compares that block against `packages/layout/src/AppShell.tsx` on
every run. No published behaviour changes — the MDX page is not part of any released
package, and the only source file touched is a test (objectui#4808).
