---
"@object-ui/core": minor
"@object-ui/app-shell": patch
---

`@object-ui/core` now ships the server-action dispatcher factory —
`createServerActionHandler({ fetch, baseUrl, resolveObject, ... })` — so any
consumer of the runner (standalone renderers, SDUI hosts, embedded usage) can
run `action.body` script actions by registering the produced handler, instead
of dead-ending on the built-in `executeScript`'s "must be executed server-side"
error with no supported way to make it run (objectui#2904, the follow-up
objectui#2896 deferred).

The factory is deliberately opinion-free about the three things core has no
business deciding — auth (`fetch` is an injected authenticated wrapper), origin
(`baseUrl` string or thunk; no bundler env convention), and fallback object
scope (`resolveObject`) — and owns everything protocol-shaped, once:

- name-based action identity (ADR-0110 D1 — `target` is a binding expression,
  never an identity);
- the record-id resolution dance, also exported as
  `resolveServerActionRecordId` (`_rowRecord`, `recordIdField`, toolbar
  selection fallback with its single/zero-select guards, aggregate
  `_selectedIds` bypass), replaceable wholesale via `resolveRecordId` for
  hosts with their own policy (record pages);
- a re-entrancy guard per action+record;
- the `/actions` response-envelope rule: `interpretActionResponse`,
  `readActionPayload` and `actionErrorDetail` moved from `@object-ui/app-shell`
  internals into core and are now public exports.

`@object-ui/app-shell`'s two hand-rolled copies of this POST —
`useConsoleActionRuntime.serverActionHandler` and `RecordDetailView`'s — are
collapsed into one console wrapper (`createConsoleServerActionHandler`) that
layers the browser-only choreography (popup pre-open dance, zero-roundtrip
`newTabUrl` fast path, `redirectUrl` convention) over the core factory. The
copies had already drifted twice (objectstack#3913 — envelope; framework#3935 —
identity, fixed in one copy only): RecordDetailView now also dispatches by
declarative `name` instead of `target || name`, and no longer leaks the
client-side `_rowRecord` stash to the server.
