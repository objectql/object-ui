---
"@object-ui/app-shell": minor
"@object-ui/console": minor
---

feat(approvals): typed decision-output pickers, quick-path guard, and approval-expression completion (framework#3447 follow-ups, #2829)

- Decision dialogs render TYPED decision outputs as record pickers: `decision_output_defs` (`{ key, label?, type, multiple? }`) maps `user` to the sys_user people picker and `department`/`position`/`team` to the matching system-object lookup; `multiple` collects an id array. Bare keys keep the text input.
- Quick decision paths (inline a/r keyboard, hover buttons, mobile card buttons, bulk apply) no longer decide a request whose node declares decision outputs (#2829) — only the drawer dialog collects those fields. Buttons render disabled with an explanation; bulk selection excludes such rows via the existing "N actionable" messaging.
- The approval `expression` approver input now has a scope-aware data picker and inline root validation: three groups — `current.<field>` (live at node entry), `trigger.<field>` (submit snapshot), `vars.*` (flow variables) — built by `useFlowScope` from the same materials as the condition picker but with the approval root set. `nodeOutputRefs` now models approval nodes (`<nodeId>.decision` + declared `decisionOutputs` keys), so the previous stage's outputs are pickable, and `vars.previous` is always listed so a legitimate `vars.*` reference is never flagged as out of scope.
