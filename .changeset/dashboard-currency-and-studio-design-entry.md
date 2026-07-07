---
'@object-ui/app-shell': minor
---

Dashboard authoring moves entirely into Studio.

The in-page dashboard **Edit** button and its inline `DashboardConfigPanel` were removed — `DashboardView` is now a pure viewer, so authoring lives in one place: Studio's Interfaces pillar. The top bar's "Design in Studio" icon is now context-aware — on a dashboard route it deep-links straight to that dashboard's design page (`/studio/:packageId/interfaces?surface=dashboard:<name>`) via the new `appStudioSurfacePath` helper, falling back to the package's Data tab elsewhere.
