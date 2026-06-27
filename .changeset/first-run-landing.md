---
"@object-ui/app-shell": patch
---

fix(first-run): two first-time-user friction fixes found via a full ObjectOS Cloud signup walkthrough.

- **Page-load race**: an app whose landing is a `type:'page'` (SDUI page) flashed a false "page not found" / blank body on the very first render — `PageView` treated the lazily-loading (empty) `pages` array as "page doesn't exist". It now shows a loading state until the `page` metadata type is actually resolved (`getTypeStatus('page')`), then trusts the not-found. This is exactly the post-signup landing, where the app's home page is the first thing rendered.
- **Redundant launcher hop**: after creating/switching a workspace, the user was hard-reloaded to `/home` (the workspace launcher) even when the workspace has a single app — an extra, contentless layer. `OrganizationsPage` and `WorkspaceSwitcher` now reload to the console ROOT (`resolveRootUrl`), so `RootLandingRedirect` resolves the right landing: a single-app workspace lands straight IN that app; multi-app workspaces still fall back to `/home`.
