---
'@object-ui/app-shell': patch
---

The `/data` surface's "New" button now reads the whole CRUD affordance matrix, not just the permission.

`ObjectDataPage` — the parameterized bare data surface (ADR-0055, objectui#2251,
route `/apps/:appName/:objectName/data`) — gated its "New" on
`can(objectDef.name, 'create')` and nothing else. It never called
`resolveEffectiveCrudAffordances` at all, so every layer below the principal's
grant was missing at once, and one authored object got a different affordance
here than it gets on the object-list page next door:

- the `managedBy` bucket default was ignored — `append-only`, `engine-owned` and
  `better-auth` all resolve `create: false`, yet this surface still offered a
  "New" that navigates to `../new`;
- the object-level `userActions: { create: false }` opt-out did not close the
  button;
- the effective API operations intersection (objectui#3391) was absent, so the
  toolbar could offer a create the server would answer with a 405;
- and `createPredicates` — the layer objectui#5153 gave the object-list page —
  was unread here as a consequence of the wider gap.

The server is the enforcement point throughout, so this was a UI-truthfulness
defect rather than a privilege escalation: the button was offered, the write was
still refused. It is now resolved exactly as `ObjectView` resolves it — the
spec's bucket/`userActions` matrix intersected with the server-resolved
effective operations, then the toolbar-scope predicate layer on top.

Predicate binding and failure posture are the family's, unchanged and not
reinvented here: `visibleWhen` fails CLOSED with declared-ness read by `?? true`
(so `visibleWhen: false` hides the button rather than reading as "ungated"), and
`disabledWhen` fails SOFT with its `!= null` declared-ness gate outside the
evaluation (so `disabledWhen: ''` reads as "no condition", and an unevaluable
predicate never greys a button forever). Like the standalone object list, this
surface has no record in scope, so a predicate reading `record.*` has nothing to
bind and fails closed — the spec's documented binding for a toolbar predicate.

The layers only ever narrow. The pre-existing permission gate is not replaced,
it is one conjunct of the new one: a passing predicate cannot re-open what the
bucket, the effective operations or the principal's grant have closed.
