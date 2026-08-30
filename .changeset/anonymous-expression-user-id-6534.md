---
'@object-ui/app-shell': patch
---

The predicate identity bound for a signed-out visitor now carries `id: null`, so a
`ctx.user.id` visibility gate BITES instead of failing open (objectui#6534).

`buildExpressionUser` has two branches, and only the signed-in one carried `id`.
So `'id' in buildExpressionUser(null)` was `false`, and an absent key is not
`false`: a CEL predicate naming `ctx.user.id` / `current_user.id` / `os.user.id`
hit an unbound key for a signed-out visitor and FAULTED. A faulting visibility
predicate fails OPEN (`evaluateVisibility`), so the gated field or action rendered
for exactly the principal it was written to exclude, with nothing on screen to say
the gate had not bitten — silently, for every signed-out visitor.

Because the defect was in the shared normaliser rather than at a mount site, it
reached EVERY mount site, including `AppContent` and the console's
`InternalFormRoute`, both of which have always called the normaliser correctly.
This is the same fault-open mechanism objectui#6515 fixed one level up, where
`RecordFormPage` hand-rolled a descriptor missing `id` and `isPlatformAdmin`.

`null` rather than `undefined`, and rather than leaving the key absent, is settled
by precedent on this exact object rather than chosen here. objectui#5424 removed
`roles` from it because a present-and-always-`undefined` key "is the shape that
teaches the wrong thing" — the context answers rather than being plainly absent,
and the answer is silently wrong; `undefined` here would reproduce that defect one
key over. Leaving it absent IS the defect. `null` is a VALUE a CEL author can
compare against, so `ctx.user.id == '…'` resolves to a clean FALSE. Measured, not
assumed: at a real mount site with `authState.user = null` and a field gated on
`ctx.user.id == 'u_admin'`, the field is now filtered OUT of the schema handed to
`ObjectForm`, where before it was present.

This also closes the last asymmetry between the two branches. Both now advertise
the same six keys, which is the symmetry objectui#5424 was closing when it removed
`roles` — and the shape pin now asserts the key sets are equal, so a future edit
that adds a key to one branch and forgets the other fails whichever branch it
forgets.

NOT CHANGED, deliberately: fail-open on a predicate that DOES fault. That is
shipped permission-boundary policy (objectui#6443 / #6487 / #6445) and remains
exactly as it was — an unevaluable `visible` still renders. This change removes a
REASON to fault; it does not touch what happens once a predicate has. No accept set
is widened, no gate is relaxed and no fallback is added: the only behavioural
movement is that an id-gated surface which used to render for anonymous visitors
now hides from them.
