---
'@object-ui/app-shell': major
---

**[ADR-0110 D1] The server-action URL identifies an action by `name`, not `target`.**

`serverActionHandler` posted `action.target || action.name` — the handler's
registration KEY — to `/api/v1/actions/:object/:action`. For a target-bound
action (`{ name: 'complete_task', target: 'completeTask' }`) the server resolves
the declaration by name, so posting the target meant it resolved **no**
declaration and silently skipped both the ADR-0066 D4 capability gate and the
ADR-0104 param contract: a Console button correctly hidden from users without
the capability posted to an endpoint that accepted anyone (framework#3935).

`target` is a binding expression — a handler key here, a flow id for
`type: 'flow'`, a URL for `type: 'url'`, `${param.X}`-interpolatable, and
legitimately non-unique — so it can never identify a declaration. The URL now
carries `action.name`, and the server derives the handler key from the
declaration it resolves. An action with no `name` is refused rather than
falling back to `target`.

`apiHandler` and `flowHandler` are unchanged: their `target` genuinely is the
endpoint / flow id they dispatch on.

Requires a framework with the ADR-0110 handler-key rotation (protocol 17); the
two ship in lockstep.
