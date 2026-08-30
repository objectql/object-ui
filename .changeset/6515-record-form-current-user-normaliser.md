---
'@object-ui/app-shell': patch
---

Field- and action-visibility gates on the full-screen record form page now see the same
`current_user` every other console surface sees (objectui#6515). `RecordFormPage` built its
own descriptor — `{ name, email, role, positions }` — instead of calling the shared
`buildExpressionUser` normaliser, so `id` and `isPlatformAdmin` were simply absent from the
predicate scope that page publishes.

An absent key is not `false`. A predicate naming one of them FAULTS, and a faulting
visibility predicate fails OPEN, so the gate silently did not bite: a field gated on
`ctx.user.isPlatformAdmin == true` (the shape `sys_environment`'s "Change Plan (admin)"
action uses) rendered for every user on this page, and an id comparison against
`ctx.user.id` (the shape `sys_user`'s own gates use throughout `platform-objects`) did the
same. Nothing on screen distinguished that from a gate that had said yes. The signed-out
branch diverged on its own account too — it carried no `isPlatformAdmin` key at all, where
`buildExpressionUser(null)` carries `false`.

Fail-open on a genuine evaluation error is deliberately unchanged (objectui#6443 / #6487 /
#6445); what changed is that these predicates no longer fault in the first place.

The normaliser moved from `console/AppContent.tsx` to `providers/expressionUser.ts`, beside
the `ExpressionProvider` it feeds. That move is what made the fix available: `RecordFormPage`
is `lazy()`-loaded BY `AppContent`, so importing the normaliser from its old home would have
put a static edge from the split chunk back into the module it was split out of. Both
`console/AppContent.js` and the package entry re-export the name, so `buildExpressionUser`
is published exactly as before.
