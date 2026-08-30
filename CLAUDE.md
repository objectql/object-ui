# CLAUDE.md

**[AGENTS.md](./AGENTS.md) is the source of truth for working in this repo — read it.**
Its rules are binding. Don't rely on this file alone; the one rule that must never be
missed is inlined here because missing it corrupts other agents' work.

## ⛔ Worktree-first — before your FIRST file edit

This repo — **and every sibling repo you touch (`framework`, `cloud`)** — is edited by
**multiple agents at once**. The shared primary checkout has its HEAD switched and its
tree reset *under you*, silently clobbering uncommitted work. **A feature branch on the
shared checkout is NOT enough** — it still gets switched under you. You MUST be in a
**dedicated per-task worktree**:

```
git fetch origin main && git worktree add ../<repo>-<task> -b <branch> origin/main && cd ../<repo>-<task> && pnpm install
```

Make all edits there, **one worktree per repo** a task spans. A PreToolUse hook
(`.claude/hooks/guard-main-checkout.sh`) enforces this — it blocks `Edit`/`Write`/
`NotebookEdit` unless the edited file is in a linked worktree, and it checks the edited
file's own repo (so sibling repos are covered). Non-task exception: `OS_ALLOW_MAIN_EDITS=1`.

## ⛔ Never `git stash` — the stash stack is NOT covered by worktree isolation

`git stash` keeps its stack in `refs/stash` inside the **common `.git` directory**, so
**every worktree shares one LIFO stack**. The per-task worktree isolation above does not
extend to it: two agents stashing in their own worktrees push and pop the *same* stack —
your `pop` restores whatever the other agent pushed a moment earlier, and your own
changes stay on the stack for them to take. `pop` reports **success**; the only symptom
is someone else's files appearing in your `git status`, and a following `git add -A`
merges their work into your PR. This is not hypothetical — it happened between two
parallel agents (objectui#3430) and cost both of them their in-flight changes.

Use one of these instead — no shared state, all inside your own worktree:

```
git diff > /tmp/wip.patch && git checkout -- <paths>   # then: git apply /tmp/wip.patch
git commit -am wip                                     # then: git reset --soft HEAD~1
git worktree add ../objectui-<task>-cmp <ref>          # a second tree to compare against
```

A PreToolUse hook (`.claude/hooks/guard-shared-stash.sh`) enforces this — it blocks
`Bash` commands that push/pop/drop/clear the stack, and allows the forms that cannot
take another agent's entry: `git stash list`/`show`/`create`, and `git stash apply <sha>`
/ `store <sha>` pinned to a **literal hex object id** (never `stash@{N}` — that is a
*position* in a stack you don't own). Deliberate exception: `OS_ALLOW_STASH=1`. Changing
the hook? Re-run `.claude/hooks/guard-shared-stash.selftest.sh`.

See **AGENTS.md** for the full playbook — both rules above are stated in full there, in
§9 多 agent 协作纪律; this file carries them only as the excerpt.
