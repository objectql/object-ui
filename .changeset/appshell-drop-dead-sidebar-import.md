---
'@object-ui/layout': patch
---

AppShell: drop the unused `Sidebar` import. `AppShell` renders the node the caller passes
in the `sidebar` prop and never constructs a `Sidebar` itself, so the import was dead
(tree-shaken out of every bundle) and only suggested otherwise to readers. No runtime
behaviour changes.
