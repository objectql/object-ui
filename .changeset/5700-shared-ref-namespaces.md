---
---

Instruction-file only. `AGENTS.md` §9 多 agent 协作纪律 gains one bullet beside the
existing `git stash` bullet, generalising it: a worktree isolates your checkout and
exactly four ref namespaces (`HEAD`, `refs/bisect`, `refs/worktree`, `refs/rewritten`)
and nothing else — not the object store, not the repo config, not any other ref. The
existing stash rule is reframed as one case of that, because a reader who learns only
the stash rule draws the opposite general conclusion.

Two further instances that have cost work are stated: `refs/remotes/*` (a sibling
agent's fetch advances *your* `origin/main`, so a path-scoped `git checkout origin/main`
restores whatever that ref points at now — possibly newer than your branch base — and
stages it), and `FETCH_HEAD` (last fetch in the checkout wins; the symptom is an empty
diff that exits 0, which reads as "the change is not there" rather than as wrong
content — a confidently wrong review conclusion about someone else's work).

The `FETCH_HEAD` isolation boundary is stated as measured rather than extrapolated from
`refs/stash`: on git 2.43 `git rev-parse --git-path FETCH_HEAD` resolves per-worktree in
a linked worktree, so a sibling's fetch in *its* worktree does not move yours; the
hazard is the shared primary checkout, where the same command resolves to the common
`.git/FETCH_HEAD` and where every agent's first fetch lands before it creates a worktree.

No hook is added — the safe forms are ordinary commands and the unsafe form is
legitimate elsewhere, so a mechanical block would fire on correct usage. No published
package changes.
