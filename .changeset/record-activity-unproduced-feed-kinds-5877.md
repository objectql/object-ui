---
'@object-ui/plugin-detail': patch
---

`record:activity` now says out loud when a `types` entry names a feed kind nothing produces.

`FeedItemType` publishes thirteen kinds and ObjectUI produces five of them
(`comment`, `field_change`, `task`, `event`, `system`). Authoring
`types: ['approval']` parsed, typechecked, built, and rendered a permanently
empty timeline with no diagnostic anywhere — a declared surface enforced by
nothing, which reads to an author, or to an AI writing the metadata, as a
working feature that simply has no data yet. The entry is still honoured exactly
as authored and nothing that renders changes; what changes is that the emptiness
is now diagnosable, on its own deduped channel beside the unrecognised-entry and
unrecognised-`filterMode` warnings already in this block.

The message keeps two populations apart, because reporting a decision as a
defect is how a warning channel gets trained out of an author's attention:
`record_create` / `record_delete` / `sharing` are named as **deliberately not
adopted** — those rows map to `field_change` on purpose, since the record page
and this block must agree what a `created` row is before either can move to the
richer kind — while the remaining kinds are reported as having no producer, and
the message stops there rather than calling that a gap. Whether somebody ruled
against a kind and left no note is not recorded anywhere the renderer can read,
and the wording says so instead of guessing.

The producer census the diagnostic reads is derived from the producers
themselves — the `sys_activity` map's range plus its unmapped fallback — so
giving a kind a producer retires its warning in the same edit. The one producer
that cannot be derived (`comment`, built from `sys_comment` rows by the console's
record page, a package this one cannot import) is declared, and a new test
re-runs the census over the whole repository so the declaration cannot go stale
silently. The warning also names what it cannot see: a host that supplies the
feed itself can produce kinds no census taken here bounds.
