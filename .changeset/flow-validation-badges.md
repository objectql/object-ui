---
"@object-ui/app-shell": patch
---

feat(studio): on-canvas validation badges + a Problems panel for the flow builder

Flow validation only surfaced as a top banner ("…N error(s)") that didn't point
to the offending element — in a non-trivial flow you couldn't tell *which* node
or edge was wrong. The simulator's `validateFlowDraft` already detected the
structural problems (no resolvable entry, unreachable nodes, a decision with no
default branch, duplicate node ids, dangling edges, un-declared cycles); they
just weren't shown on the canvas. This was a surfacing gap, not a detection one.

The flow preview now:

- renders an error / warning **badge** on each offending node and edge, with the
  issue message(s) as its tooltip;
- adds a **Problems panel** listing every issue (structural + the server
  `_diagnostics` already attached to the layered record); clicking a row selects
  and reveals (pans to) the node/edge;
- clears badges + rows as issues are resolved (everything derives from the live
  draft).

`validateFlowDraft` now tags dangling-edge errors with their endpoints so they
key to the offending connection, and a new `flow-problems` module maps both
sources onto concrete canvas elements (node id / stable edge key). Server
diagnostics reach the preview through a new optional `diagnostics` prop on
`MetadataPreviewProps`.
