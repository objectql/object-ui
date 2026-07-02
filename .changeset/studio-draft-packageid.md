---
"@object-ui/app-shell": patch
---

fix(studio): stamp packageId on pillar draft saves → true package-scoped publish

Studio pillar draft-saves now pass the active `packageId`, so each draft row is
stamped with its package binding (`sys_metadata.package_id`) instead of `null`.
This makes the package-scoped surfaces reliable: the top-bar count + Changes review
filter via `GET /meta/_drafts?packageId=`, and Publish promotes exactly this
package's drafts via `POST /packages/:id/publish-drafts` (which matches
`WHERE package_id = X`). Replaces the previous "publish all pending" fallback that
was only needed because null-package drafts couldn't be package-filtered or picked
up by publish-drafts.
