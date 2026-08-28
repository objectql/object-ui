---
---

CI/doc-only: records the measurement of the last remaining "Lockfile Merge Driver" row
(objectui#6391). No mechanism is added or removed.

`changeset-release.yml` performs no local merge, so the driver it configures cannot fire in
that job. Swept the whole file with a control term on every zero-hit — no `git merge`,
`rebase`, `pull`, `cherry-pick`, `am`, `apply` or `revert`; every `git` in it is the two
`git config` lines, `git status` twice, and the `git checkout -- .` / `git clean` pair that
undoes the version step, `checkout -- .` being an index-restore rather than a merge. The
deciding fact is in the marketplace action: read at `changesets/action` v1.9.0 (`a45c4d5`),
`src/git.ts` and the shipped `dist/` agreeing, its entire git surface is `checkout`,
`reset --hard`, `add .`, `commit -m`, `push --force` and `config user.*` — the version branch
is updated by `reset --hard` plus a force-push, and a force-push resolves no merge.

⭐ The `.gitattributes` line is NOT dead, which is why the row was not removed with the other
two. `CONTRIBUTING.md` has contributors configure the same driver and then `git merge
upstream/main` — a real local merge on the attributed path. Measured in a scratch repository
with one variable changed: with the attribute the driver fires and the lockfile is
regenerated; without it the identical merge ends in `CONFLICT (content)`. The CI half is dead
and the repository-wide half is live, while `ci-cd-pipeline-doc.test.ts` binds them together,
so the removal is a decision rather than a cleanup and is escalated instead of guessed.

The row's stated reason ("version bumps rewrite the lockfile") was wrong and is corrected — a
rewrite is not a merge — and the guide gains the third ⛔ note in the series that already
records "pushing is not merging" and "a server-side merge is not a local one".

No source and no behaviour change; nothing a consumer installs is affected.
