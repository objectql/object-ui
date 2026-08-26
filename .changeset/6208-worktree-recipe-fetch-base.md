---
---

Instruction-file and PreToolUse-hook prose only: no published package's `src/` changed, so
nothing ships.

The documented worktree recipe branched off the **local** `main` ref, which nothing in the
recipe or its surrounding prose fetches. A worktree created by following it literally starts
as far back as whoever last happened to update that ref — and on a long-lived shared
checkout, nobody has a reason to. `origin/main` alone would carry the same defect one layer
down (it too is a local ref only a fetch moves), so each in-scope site now begins with an
explicit `git fetch origin main &&` and names `origin/main` as the base:

```
git fetch origin main && git worktree add ../<repo>-<task> -b <branch> origin/main && cd ../<repo>-<task> && pnpm install
```

Four sites repaired — `CLAUDE.md`, `AGENTS.md` §9 多 agent 协作纪律, and the recipe both
worktree guards print when they block an edit (`.claude/hooks/guard-main-checkout.sh`,
`.claude/hooks/guard-main-checkout-bash.sh`), which is the copy an agent is most likely to
run verbatim. The two `-cmp` comparison-tree lines are unchanged: they take an explicit ref
from the caller and are correct as written.

Ports the repair landed upstream in objectstack#11934 (objectstack#11540); this repo's copy
was deliberately left to this card. Net ±0 lines on every file touched.
