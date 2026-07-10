---
'@object-ui/app-shell': minor
---

feat(detail): honor object `enable.feeds` / `enable.activities` opt-out gates (framework#2707)

RecordDetailView rendered the discussion panel and merged the sys_activity
timeline unconditionally; the object capability flags gating them were dead.
Both are now honored with opt-OUT semantics (spec default flips to `true`,
so absent block/flag = unchanged behavior; only an explicit `false`
disables):

- `feeds: false` hides the record discussion panel (both the page-schema
  auto-append and the legacy DetailView `discussionSlot`) and skips the
  sys_comment fetch. The server independently rejects new comments for such
  objects (403 FEEDS_DISABLED).
- `activities: false` skips the sys_activity fetch/merge — the server stops
  mirroring CRUD for such objects, so this also keeps the network quiet.

Also fixes the long-wrong comment claiming plugin-audit's writers were
gated by `enable.activities` opt-in (they were unconditional; the new
contract is opt-out). The History tab gate (`enable.trackHistory === true`)
is unchanged.
