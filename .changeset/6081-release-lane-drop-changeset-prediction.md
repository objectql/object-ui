---
---

CI-only change: the `lane` job in `.github/workflows/changeset-release.yml` no longer
predicts whether `changesets/action` will see a pending changeset. Its bash mirror of
the action's file scan and the `pending_changesets` output it fed are deleted, and the
release job's clear step now runs on every push run — `if: github.event_name == 'push'`.

This supersedes the mirror that `5775-lane-changeset-reader-mirror.md` describes, and
with it `scripts/__tests__/changeset-release-lane-mirror.test.ts`. The mirror could not
be kept honest: `changesets/action` is used at a moving tag whose bundled
`@changesets/read` is a different major from the installed one, and it is a minified
chunk nothing here installs, so no test could execute it and no lockfile recorded it.
The `changesets/action@v1` ref pin that lived in that test file is re-homed, not
dropped — it now has its own file,
`scripts/__tests__/changeset-release-action-ref-pin.test.ts`, and covers both `uses:`
lines instead of one.

No published package changes and no release behaviour changes: the clear step is
idempotent and a measured no-op on a tree with nothing pending (`Removed 0`, exit 0,
byte-identical tree), so running it unconditionally on the push lane does what the
prediction was there to arrange. The `github.event_name == 'push'` test is retained
deliberately — dropping it too would empty the tree on the refresh lane and fossilise
the version PR silently.
