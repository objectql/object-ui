---
"@object-ui/app-shell": minor
---

Flow designer: the `script` node authors a function call, and nothing else (framework#4343).

**Breaking for authoring**, not for stored metadata: the `script` panel no longer
offers `Action type`, `Template`, `Recipients`, `Template variables` or the inline
`Code` body. What it offers is the function path — `Function` (required),
`Inputs`, `Output variable` — shown unconditionally, since there is no action type
left to gate them behind.

framework#4343 retired those five keys because none of them ran. `actionType:
'email' | 'slack'` were logger-backed stubs: they wrote a log line, reported
success, and delivered nothing under any configuration, with `template` /
`recipients` / `variables` addressing a message no channel sent. Inline
`config.script` was recognized and never executed — the built-in runtime has no
server-side JS sandbox. Any other `actionType` value was a second spelling of
`function`. Real delivery is a **`notify`** node (the messaging service: in-app
inbox by default, email once `@objectstack/plugin-email` is installed); Slack is a
**`connector_action`** with the Slack connector, or an `http` node posting to a
webhook.

**Stored nodes are never hidden.** All five keys keep a legacy render-only field
(`__legacy__` gating — the rule this group already followed for the `code` / `sms`
/ `notification` action types objectui#3099 dropped), each labelled `(retired)`
with its replacement in the help text. `os migrate meta --from 16` rewrites the
metadata; a shorthand `actionType` moves into `function`, which is what it named.

The flow canvas subtitle now leads with the function name (falling back to the
retired keys so an unmigrated node is never blank), and the simulator says what a
retired branch actually did rather than pretending it mocked a notification.

The cross-repo reconciliation ledger spans the spec bump: on a spec that still
publishes the retired branches it asserts only that the form offers nothing the
executor ignores; on the spec that retires them (`SCRIPT_BUILTIN_ACTION_TYPES`
disappearing is the discriminator) the full bidirectional comparison arms itself.
Verified against a locally built framework spec: the converged panel reconciles
clean in both directions.
