---
'@object-ui/app-shell': minor
---

feat(packages): "Discard changes" and "Delete app" buttons in the package detail sheet

Adds two one-click package-lifecycle actions next to the existing "Publish app", mirroring the new backend endpoints:

- **Discard changes (N)** — next to "Publish app" in the Pending changes block. Drops every pending draft via `POST /packages/:id/discard-drafts`, reverting the app to its last published baseline. Non-destructive (published metadata + data untouched), then refreshes the pending list.
- **Delete app** — in the Actions row. Removes the whole package via `DELETE /packages/:id` (active + draft metadata + drops each object's table). Confirms first ("this cannot be undone"); closes the sheet on success, keeps it open and shows the error on failure.

Together with "Publish app", this gives the full AI-build review loop a UI: publish to preview → keep, **discard all changes**, or **delete the app**.
