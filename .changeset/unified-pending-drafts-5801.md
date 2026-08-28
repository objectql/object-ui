---
'@object-ui/app-shell': minor
---

One pending-drafts source of truth (#5801): `usePendingDrafts` / `fetchPendingDrafts` replace the five hand-rolled `GET /api/v1/meta/_drafts` copies behind the home banner, Studio topbar 变更/待发布 buttons, chat pending-drafts bar, chat draft-card resolver, and the preview watermark bar. Every successful publish path (`usePublishAllDrafts`, Studio `doPublish`, the chat bar) now emits the assistant bus's metadata-refresh pulse, and a chat turn that staged or replayed drafts emits it on completion — so a publish or an agent-staged draft anywhere converges every surface at once, and the home banner no longer needs its post-publish `window.location.reload()`. An errored drafts read now uniformly reports UNKNOWN (null), never a fake zero.
