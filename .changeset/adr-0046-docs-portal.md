---
"@object-ui/console": minor
"@object-ui/app-shell": minor
---

Package documentation portal + nav entry (ADR-0046).

The `/docs/:name` viewer already existed but had no way in: no index and no
navigation entry, so a doc was reachable only by typing its exact URL. Adds a
platform-level docs portal at `/docs` (`DocsIndex`) that lists every installed
`doc` metadata item grouped by package namespace, each linking to the existing
viewer. A "Documentation" entry now appears in the home/system navigation
(`UnifiedSidebar`), visible to all users (not gated behind workspace-admin), so
docs are discoverable. The viewer route stays app-independent and
single-coordinate (`/docs/<name>`); per-app deep-links remain opt-in `url` nav
items pointing at that same global URL. Doc grouping is a pure, unit-tested
helper (`groupDocsByPackage`).
