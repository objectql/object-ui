---
---

Removes the dead CI half of the `pnpm-lock.yaml` merge driver and re-points the mechanism at
what it now is: contributor-facing, with zero CI consumers (objectui#6436, maintainer ruling of
2026-08-27 adopting option B).

`changeset-release.yml` configured `merge.pnpm-merge` but performs no local merge — the version
branch is updated by `reset --hard` plus a force-push inside `changesets/action`, and a
force-push resolves nothing — so that configuration could never fire. It was the last CI
consumer. `.gitattributes` and CONTRIBUTING.md's contributor path are kept: measured in a
scratch repository with one variable changed, the attribute is what turns a conflicting lockfile
merge into a regeneration instead of conflict markers left inside `pnpm-lock.yaml`.

The pin test's anti-vacuity weight moves rather than vanishing. `configuring.length > 0` was
doing two jobs — proving the grep matched something, and proving the mechanism had a consumer.
Zero is the correct count now, so job one moves to a control term that must hit the same
population (`git config`, which `changelog.yml` runs) and job two moves to the two files that
are the mechanism today: `.gitattributes` and CONTRIBUTING.md. The phantom direction becomes
load-bearing, since it now asserts the page names no workflow at all.

Also re-points, for the second time, the worked-example citation in
`scripts/check-pre-install-import-graph.mjs` that cited this config as "a quoted argument that
must not be read as an install". No live in-repo example remains, so it is cited as formerly
`changeset-release.yml`, anchored on the test case's name rather than a line number.
