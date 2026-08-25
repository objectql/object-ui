---
---

CI-only change: the `lane` job in `.github/workflows/changeset-release.yml` now scans
`.changeset/pre/*.md` as well as `.changeset/*.md`, and matches the reader's README
exclusion case-insensitively (`/^README\.md$/i`) instead of comparing the one exact
spelling. `scripts/__tests__/changeset-release-lane-mirror.test.ts` pins the step's
script against the installed `@changesets/read`, executed rather than transcribed, so a
dependency bump that changes the ignore list fails there instead of drifting.

No published package changes, and no release behaviour changes: `pending_changesets`
gates only the release job's clear step, and both edits make it count MORE, never less.
