---
'@object-ui/app-shell': minor
---

⚠️ **Behaviour change: `current_user` and `features` gates on an object field's
`visible` that have been doing nothing on the record form page and in the
console's record modal now TAKE EFFECT.** Read this before upgrading if any of
your object metadata gates a field on the session user or on a deployment flag.

objectui#6010 and objectui#6110 bound the host predicate scope on the form
renderer and on the console form routes. `evaluateVisibility` was still being
reached with a THIRD and FOURTH evaluator that neither of those touched:
`RecordFormPage` and `AppContent` each built a private
`new ExpressionEvaluator({ user, app, data })` for the field-visibility filter,
beside — not from — the `ExpressionProvider` each of them mounts. Those bags
bound `user`, but not the canonical `current_user` nor the ADR-0068 `ctx.user` /
`os.user` spellings of that same object, and not `features` at all. So one
authored predicate meant two different things depending on which evaluator
reached it: `current_user` resolved on a nav item and was unbound on a field.
Both sites now build their scope with the same `buildExpressionScope` the
provider uses, which is the only declaration of what an app-shell predicate may
name.

**Why nobody noticed, and why the fix is felt as a change.** A field `visible`
predicate fails OPEN: a field on screen is what you get when the predicate says
TRUE, when the root was never bound so the predicate faulted, *and* when the
predicate has a typo. Those worlds are indistinguishable, so an app that
authored a `current_user` gate saw the field render and had no way to tell the
rule was inert. After this change the predicate is evaluated for real, and
**fields that have always been visible will disappear for the users the rule
excludes** — and a `features` gate whose flag is off will hide its field once
`/api/v1/auth/config` resolves.

`AppContent`'s bag also hand-rolled its user as `{ name, email, role }`, without
`positions`. It now uses the same `buildExpressionUser` normaliser every other
console surface publishes, so `'sales' in current_user.positions` — the gate the
server enforces on write — reaches the same verdict client-side instead of
faulting open.

**Before upgrading**, audit any `visible` predicate in your object metadata that
names `current_user` (or `user` / `ctx.user` / `os.user`) or `features`, and
confirm each says what you actually want evaluated. Measured on the metadata
shipped in this repo and in the framework at the time of the change: **nothing
in it authors such a gate**, so no shipped surface changes behaviour today —
the audit is for your own object metadata, which this cannot see.

**The error path is deliberately unchanged.** A predicate that throws still
fails open, exactly as objectui#6443 / objectui#6487 left it. This change is
about which roots are BOUND, not about what happens when evaluation fails.
