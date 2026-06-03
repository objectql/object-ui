---
'@object-ui/app-shell': minor
---

feat(studio): add "Publish app" button to publish all package drafts (ADR-0033)

The package detail's Pending changes section gains a primary **Publish app (N)** button that calls `POST /api/v1/packages/:id/publish-drafts` to promote every drafted item of the app in one shot, then refreshes the pending list. Complements the per-item review/publish links — so after an AI builds an app you can review item-by-item or publish the whole thing at once.
