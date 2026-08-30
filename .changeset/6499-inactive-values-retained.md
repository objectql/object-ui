---
'@object-ui/app-shell': minor
---

metadata-admin inspectors: name the "inactive values retained" state instead of
rendering it as live configuration (objectui#6499).

`showWhen` gates rendering only, and `isFieldVisible` additionally re-shows any
field that already holds a stored value — deliberately, "so existing config is
never hidden". The consequence on screen: an author who enabled a controller,
filled its dependent fields, then switched the controller back off keeps seeing
those fields as ordinary, live-looking controls. The stored config and the
switch beside it disagree, and nothing said which one was in effect.

Per the maintainer ruling of 2026-08-27 (Option C), the values are KEPT and the
state is made explicit. Pruning on save was rejected: it silently discards
config an author entered, and inverts the very rule that stops config from
vanishing unseen.

- New `inactiveRetainedKind(field, node, fields)` in `flow-node-config.ts` — a
  pure read that reports a field rendered ONLY because the stored-value re-show
  rule fired. It distinguishes `'controller-off'` (a real toggle the author can
  switch back on) from `'no-controller'` (the `__legacy__` render-only keys,
  where no such toggle exists and saying otherwise would be a fresh lie).
- `FlowNodeConfigField` renders the notice beside the affected control, with a
  "Clear value" action so the author can discard the residue **deliberately**.
  Read-only inspectors show the notice without the action.
- Coverage is every `showWhen` group in the inspectors, pinned mechanically:
  all 33 gated fields across the descriptor tables, plus the two runtime
  producers (an engine-published `configSchema` and a connector input schema)
  that mint groups no source file contains.

Render-layer only: no save-path change, no data deletion, and `isFieldVisible`'s
stored-value re-show rule is unchanged — clearing is an ordinary author-initiated
field commit, the same write as emptying the control by hand.
