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
git worktree add ../<repo>-<task> -b <branch> main && cd ../<repo>-<task> && pnpm install
```

Make all edits there, **one worktree per repo** a task spans. A PreToolUse hook
(`.claude/hooks/guard-main-checkout.sh`) enforces this — it blocks `Edit`/`Write`/
`NotebookEdit` unless the edited file is in a linked worktree, and it checks the edited
file's own repo (so sibling repos are covered). Non-task exception: `OS_ALLOW_MAIN_EDITS=1`.

See **AGENTS.md** for the full playbook.
