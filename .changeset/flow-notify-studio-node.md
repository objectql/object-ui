---
"@object-ui/app-shell": patch
---

feat(studio): first-class `notify` flow node in the Studio palette + inspector

The `notify` flow node (ADR-0012 — outbound notification via the messaging
service) is a live built-in with a server descriptor, but Studio had no static
palette entry or config editor for it: `fieldsForNodeType('notify')` returned
`[]`, so it was only authorable by hand-editing JSON or when the running engine
happened to publish its descriptor (framework#1878 / framework#1895).

- Added `notify` to `NODE_PALETTE` (Integration), with a Bell icon and the
  integration tone, canvas category, and a sensible default-config seed
  (`channels: ['inbox']`).
- Added a `notify` entry to `FLOW_NODE_CONFIG` mirroring the built-in node's
  descriptor keys: `recipients`/`channels` (stringList), `title`, `message`
  (textarea), `topic`, `severity` (select info/warning/critical), and the
  click-through target (`sourceObject`/`sourceId`/`url`) — all written under
  `node.config`.

Closes the last item of the designer-authoring-gaps issue (framework#1895).
Unit + DOM tested (palette entry, config field kinds/paths, no inspector
regression). A browser dogfood pass of authoring a notify node end-to-end is
recommended before merge.
