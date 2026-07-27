---
"@object-ui/app-shell": minor
"@object-ui/console": minor
---

feat(approvals): dynamic decision-output fields + expression approver editing (framework#3447 P2)

- The approve/reject dialogs now render one input per author-declared decision-output key (the row's `decision_outputs`, per-request so it can't be a static action param). DeclaredActionsBar synthesizes `outputs.<key>` params; the api handler folds them into the nested `outputs` body the decide route expects. Blank optional outputs are omitted.
- The flow designer's approval-node approver list renders an `expression`-type approver's value as a CEL expression input (mono + syntax check) instead of a dead free-text reference box, with a placeholder teaching the three legal roots (`current.*` / `trigger.*` / `vars.*`). Flow-scope pickers are deliberately not wired in — approval expressions have their own closed root set, and offering flow-scope paths would teach exactly the spelling the runtime rejects.
- Static fallback descriptor gains the `Expression (CEL)` approver type, the expression-only `resolveAs` column, and the node-level `onEmptyApprovers` policy select (the online form derives all of these from the engine's published configSchema).
