---
"@object-ui/components": patch
"@object-ui/react": patch
---

Action-face predicates written against the canonical `record.` root now evaluate

`action:button`, `action:icon`, `action:menu` and `action:group` gated their
actions on `useCondition(pred, context)`, which evaluates on
`new ExpressionEvaluator({ ...scope, ...context })` — and the context each of
them passed was the row spread flat, or nothing at all. Only the shorthand
spelling resolved:

| predicate | verdict, before |
|---|---|
| `status == "pending"` | evaluates (`action:button` only) |
| `record.status == "pending"` | throws `record is not defined` |
| `data.status == "pending"` | throws `data is not defined` |

`record.` is not a mistaken spelling — it is the canonical one. It is what
`ExpressionEvaluator`'s CEL path binds (`bag.record` as the record namespace),
what `evalRowPredicate` binds on the record header, list rows, the row kebab
and conditional formatting (`record.status` / bare `status` / `data.status`),
and what the server enforces with. A `visible` that fails CLOSED turns the throw
into "hidden", so a correctly-authored predicate deleted its own button —
indistinguishable from the gate having said no. On the fail-soft legs the same
throw lands the other way: `disabled` greyed a control out for everyone.

Live rather than theoretical: every declared action on framework's
`sys_approval_request` gates on `record.viewer.*`, so the whole server-declared
approval decision set was invisible wherever the declared-action bar rendered
until objectui#4077 fixed that bar. These four generic renderers carried the
same binding.

What changed:

- all four bind the row the three canonical ways, through one named helper
  (`usePredicateRecordContext`, exported from `@object-ui/react` beside
  `useCondition`), so the action face and the row surfaces answer an author's
  `visible:` the same way;
- `action:icon` reads the row at all. It evaluated against an empty bag, so not
  even the bare-field shorthand resolved — and its `data` prop was landing in
  the props spread onto the DOM button;
- `action:menu`'s items and `action:group`'s two leaves receive the row from
  their host, which they previously never got;
- `action:bar` forwards the row into the overflow menu it builds, not just to
  its inline members. An action's predicate had been answering a different
  question purely because it spilled past `maxVisible` — which on mobile
  defaults to 1, making the verdict a function of the viewport.

Deliberately unchanged: the evaluation entry and each site's error policy. A
predicate that genuinely faults still fails closed on `action:button` /
`action:menu` `visible` and still fails soft on the other legs, exactly as
before; `toPredicateInput`, `hasDeclaredVisibilityGate` and the empty-predicate
rules keep their pinned semantics. Binding the row is a separate question from
what to do when the predicate faults.

A surface with no row of its own binds nothing rather than an empty record, so
a host that supplies the row through the ambient predicate scope is not blanked
out; a row passed explicitly still wins over the scope.
