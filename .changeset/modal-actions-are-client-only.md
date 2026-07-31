---
'@object-ui/app-shell': minor
---

**[objectstack#3959] A `type: 'modal'` action is client-side only — the server fallthrough is removed.**

`modalActionHandler` fell through to `serverActionHandler` when the action's
target resolved to neither a page nor an object, documented as "how a modal
action bound to `engine.registerAction(...)` still runs". It never ran: the
framework's `headlessActionTypeError` rejects `type: 'modal'` over REST with a
400, because a modal action has no server dispatch. The fallthrough only turned
an authoring mistake — a target naming no page — into a confusing round-trip,
and it let apps ship handlers that no declaration could address (app-todo's
`deferTask` / `setReminder` sat dead for exactly this reason).

An unresolvable target is now reported as what it is, naming the action, the
dud target, and the way out. To collect input and then run server-side,
declare `type: 'script'` with `params` — the runner collects the same dialog
and the handler runs with those values.
