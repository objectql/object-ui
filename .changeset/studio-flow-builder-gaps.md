---
"@object-ui/app-shell": patch
---

fix(studio/flow): wire decision branches to edges, expand screen config, align simulator with engine

Four fixes for the Studio Flow Builder, found dogfooding it as a business user:

- **Decision branches now route.** The "Branches" editor wrote `node.config.conditions`
  but never the outgoing edges, so a decision built entirely in Studio left every
  out-edge unconditional — the engine and simulator (which branch on `edge.condition`)
  ran *all* branches. Branches now mirror onto the node's out-edges (by order):
  `FlowCanvas.addNode` carries the matching branch onto a newly-connected edge, and
  `FlowNodeInspector` re-syncs existing edges when branches are edited (a `true`
  expression marks the default/else edge).
- **Screen node config expanded.** The form exposed only `fields`; it now also edits
  `title`, `description` (interpolates `{var}`), `waitForInput`, and the object-form
  keys (`objectName`, `idVariable`, `mode`, `defaults`) — so a message screen or an
  object-form wizard step no longer requires dropping to Advanced JSON.
- **Simulator applies assignment nodes.** Assignment was a no-op pass-through, so a
  Debug run never reflected `Set variables`. It now normalizes the same shapes the
  engine accepts (`assignments` map/array + flat) and interpolates `{var}`.
- **Simulator screen-pause parity.** The simulator paused on every screen; it now
  pauses only when the screen collects input (`fields`) or sets `waitForInput`,
  matching the engine's `shouldPause` — a field-less screen passes through.
- **Palette HTTP de-duplicated.** The base palette hardcoded the deprecated
  `http_request` alias while the engine publishes the canonical `http`, showing
  two HTTP entries. The base now uses `http` (merging into one), aliased to the
  `http_request` config form so the inspector is unchanged.
