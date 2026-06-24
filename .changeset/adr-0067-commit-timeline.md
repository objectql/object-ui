---
'@object-ui/app-shell': minor
---

Build-history timeline + revert UI for AI builds (ADR-0067)

The unpublished-app banner gains a **History** button that opens a commit timeline (`GET /packages/:id/commits`): every change an AI build/edit landed, newest-first, with **Revert** per apply commit (`POST /packages/:id/commits/:cid/revert`). The history-not-confirm model — review the timeline and revert, instead of approving each publish.

- `commitHistory.ts` — `fetchCommits` / `revertCommit` helpers.
- `CommitTimeline.tsx` — slide-over panel (sibling of `DraftChangesPanel`).
- `UnpublishedAppBar` — History button + timeline mount (package-scoped).
