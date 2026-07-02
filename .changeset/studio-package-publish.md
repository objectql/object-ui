---
"@object-ui/app-shell": patch
---

feat(studio): package-level draft publish (replaces per-item publish)

The pillar Studio now publishes at the **package** level, not item-by-item. Edits
across Data / Automation / Interface accumulate as per-item **drafts**; the top bar
shows a pending-draft **count**, a **变更** (Changes) review, and one **发布** that
publishes **all** pending drafts in a single governed pass — reusing
`usePublishAllDrafts` (per-package `publish-drafts` with structure-before-seeds + the
ADR-0038 L3 probes, and by-reference for orphan / null-package drafts).

- The per-pillar **发布** buttons are removed; **保存草稿** stays (drafts accumulate).
- The Data grid's drag-reorder no longer **auto-publishes** — it saves a draft like
  every other edit, so nothing goes live outside the one package publish.
- After a publish, pillars re-read the fresh published baseline (a publish nonce),
  and a draft-save refreshes the pending count.
