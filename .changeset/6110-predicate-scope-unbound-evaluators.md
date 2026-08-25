---
'@object-ui/app-shell': minor
'@object-ui/console': minor
'@object-ui/plugin-form': minor
---

⚠️ **Behaviour change: `current_user` predicates that have been doing nothing on
the console form routes and in the wizard's submit gate now TAKE EFFECT.** Read
this before upgrading if any of your form metadata gates on the session user.

objectui#6010 bound the host predicate scope on the five authored-predicate call
sites in the components form renderer, so `current_user` (plus the ADR-0068
`user` / `ctx.user` / `os.user` aliases) resolves on `visibleWhen` / `visibleOn`
there. Two other authored-predicate evaluators were still passing `undefined`
for that argument, so the same authored text meant two different things
depending on which surface opened the form (objectui#6110):

- **`apps/console`'s form renderer**, on the authed internal route
  `/forms/:name`. The internal route is a runtime record surface by ADR-0089
  D1's own words (*"runtime record surfaces bind `record` + `current_user`"*),
  and its `visibleWhen` metadata is the same `*.view.ts` FormView the
  object-view chain renders — so a role gate authored once behaved differently
  depending on which route opened the form.
- **`WizardForm`'s submit-time required re-check** (`missingRequiredByStep`),
  the gate that re-checks the whole declared field set at final submit because
  `allowSkip` can jump past a step. Its docstring promises *"the same verdict
  from all three rather than a second, divergent dialect"*, and since #6010 it
  was the divergent one.

**Why nobody noticed, and why the fix is felt as a change.** `visibleWhen` fails
OPEN: a field on screen is what you get when the predicate resolves TRUE, when
the scope was never bound so the predicate faulted, *and* when the predicate is
broken. Those worlds were indistinguishable, so an app that authored a
`current_user` gate saw the field render and had no way to tell the rule was
inert. After this change the predicate is evaluated for real, and fields and
sections that have always been visible will disappear for the users the rule
excludes. `requiredWhen` fails the other way (CLOSED), so a `current_user`
requiredWhen that has been silently not applying will now start holding submits.

In the wizard the change is a fix in the user's favour as well: a required field
the wizard HID from this user was still counted as visible by the submit gate,
so the submit was refused on a control the submitter could neither see nor fill
in.

**Before upgrading**, audit any `visibleWhen` / `visibleOn` / `requiredWhen` in
your form-view and object metadata that names `current_user`, and confirm each
predicate says what you actually want evaluated against `record` +
`current_user`.

**The public anonymous form `/f/:slug` is deliberately unchanged.** It is
mounted outside `ProtectedRoute` so an anonymous visitor can submit it, there is
no authenticated principal, and no provider is mounted above it — so its scope
is empty and a `current_user` predicate authored on a public form still faults
and still fails open, exactly as before. Nothing new is declared to say so: the
two routes are told apart by which component mounts them.

`@object-ui/app-shell` exports `buildExpressionUser`, the `ExpressionProvider`
user normalisation, so every console surface that mounts the provider publishes
the same `current_user` shape rather than re-deriving it.
