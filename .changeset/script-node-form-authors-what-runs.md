---
"@object-ui/app-shell": minor
---

feat(flow-designer): the script node's form authors what the executor runs — framework#4278

The `script` flow node is one of five builtins whose designer form lives only
in this package's hand-written `FLOW_NODE_CONFIG` table (the engine publishes
no `configSchema` for them, deliberately), and nothing reconciled that table
against the executor. It had drifted user-visibly: of the four `actionType`
options offered, `code` was a recognized no-op (the built-in runtime has no
server-side JS sandbox) and `sms` / `notification` failed every run (neither
is a built-in — they resolve as function names); the "Output variables"
(plural) field was read by nothing; and the one path that runs real logic —
`function` + `inputs` + `outputVariable` — could not be authored at all.

- The `actionType` select now offers **Call function** (default) / **Email** /
  **Slack**, mirroring the executor's dispatch set
  (`SCRIPT_BUILTIN_ACTION_TYPES` + the `invoke_function` marker). The function
  path fields (`function`, `inputs`, `outputVariable`) are first-class.
- The inline `script` body becomes render-only: hidden for new nodes (its help
  states it is NOT executed and steers to a registered function), still shown
  whenever a stored node carries one. The dead plural `outputVariables` field
  is removed; stored values surface in the Advanced (JSON) block.
- A scalar select whose stored value was dropped from the options now renders
  it as a flagged "`<value> (deprecated)`" entry instead of blanking it —
  the same rule FlowObjectListField already applied to select cells.
- The data picker (`flow-scope`) and the flow simulator stop pretending the
  legacy `outputVariables[]` list binds variables — the engine never binds
  those names; only the singular `outputVariable` does.
- New reconciliation test: the hand-written `script` / `subflow` / `decision`
  groups are compared bidirectionally against the executor-derived config
  contracts `@objectstack/spec/automation` publishes for exactly this purpose
  (framework#4278), and the `wait` / `connector_action` / `boundary_event`
  groups against the `FlowNodeSchema` sibling blocks. The spec-export panels
  feature-detect and arm themselves on the next `@objectstack/spec` bump.
