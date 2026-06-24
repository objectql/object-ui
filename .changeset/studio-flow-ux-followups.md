---
"@object-ui/app-shell": patch
---

feat(studio/flow): context-aware Start trigger fields + explicit decision-branch binding

Two flow-builder UX improvements (follow-ups to the decision/screen/simulator fixes in #1927):

- **Start node trigger fields are now context-aware.** The Start node showed `Object`
  and `Entry condition` (record-trigger config) even on screen / manual flows where
  they don't apply. They're now gated by the chosen `triggerType` — shown for record /
  schedule / webhook / event triggers, hidden for manual / unset (screen wizards). A
  field that already holds a value is never hidden, so existing flows are unaffected.

- **Decision branches can be bound to edges explicitly.** Selecting a decision out-edge
  now shows a **Branch** picker listing the source decision's branches (label · condition,
  or "· default"). Picking one writes that branch's expression / label (or marks the
  default) onto the edge — so routing stays correct even when edges are connected out of
  branch order, instead of relying solely on the implicit by-order auto-wire. A
  "— Custom —" option preserves manual editing.

Adds `flow-node-config.test.ts` covering the trigger-field gating.
