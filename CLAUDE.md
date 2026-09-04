# CLAUDE.md

**[AGENTS.md](./AGENTS.md) is the source of truth for working in this repo — read it.**
Its rules are binding: each of the two rules that must never be missed is inlined below as
one sentence, its enforcing hook, and a pointer to the AGENTS.md heading.

## ⛔ Worktree-first — before your FIRST file edit

Never edit a shared primary checkout — this repo's or any sibling repo's (`framework`,
`cloud`); its HEAD and tree move under you, and a feature branch there is not enough. One
dedicated worktree per task, per repo. Hooks in `.claude/hooks/`: `guard-main-checkout.sh`
(Edit/Write/NotebookEdit) and `guard-main-checkout-bash.sh` (the same writes as Bash);
override `OS_ALLOW_MAIN_EDITS=1`. Full rule: AGENTS.md → **9. Operational Rules**, its
paragraph **多 agent 协作纪律**.

## ⛔ Never `git stash` — the stash stack is NOT covered by worktree isolation

`refs/stash` lives in the common `.git` dir, so all worktrees share one LIFO stack: your
`pop` takes another agent's entry and reports **success** — use a patch or a wip commit.
Hook `guard-shared-stash.sh` enforces it (override `OS_ALLOW_STASH=1`; re-run its
`.selftest.sh` if you change it). Full rule: AGENTS.md → **9. Operational Rules**, its
paragraph **多 agent 协作纪律**.

See **AGENTS.md** for the rest: the JSON protocol, coding standards, how to run the tests,
the governed surface, and the merge-queue PR flow.
