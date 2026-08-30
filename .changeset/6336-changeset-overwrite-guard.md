---
---

Internal CI-only change: a new report-only `Changeset Overwrite Report` job in
`changeset-guard.yml` names any `.changeset/*.md` a change modified or deleted
without having added it, and prints the release declaration that was there.

No published package changes, so this releases nothing.

objectui#6336 — a hand-picked `changesets`-style filename can land on one that
already exists, and the overwrite is silent in both directions that should catch
it: `git status` reports ` M` rather than `??`, and a deleted release declaration
is flagged by nothing downstream. The cost lands on a third party — whichever
earlier pull request's declaration disappears — and surfaces only when a package
fails to bump.

Report-only is measured, not cautious: across all 5281 first-parent commits on
`main`, every one of the 19 modifications of a pre-existing changeset was
legitimate, so a blocking gate would have failed all of them.
`OS_CHANGESET_OVERWRITE_ENFORCE=1` flips it for whoever revisits that with a new
measurement.
