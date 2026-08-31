---
---

Instruction-file prose only: no published package's `src/` changed, so nothing ships.

**The worktree recipe now specifies `--no-track`.** The prescribed form in `CLAUDE.md` and
`AGENTS.md` created the branch with plain `-b`, which writes the new branch's upstream keys
(`branch.NAME.remote`, `branch.NAME.merge`) into the one `.git/config` that every linked
worktree of a repo shares. That write can fail *after* the branch is created, leaving a
branch with no worktree — a half state in the very first step of the recipe, and one the
error text does not name. Measured on git 2.43.0: `--no-track` removes the config write and
still bases the worktree on `origin/main`; `git push -u origin BRANCH`, already the
prescribed first push, sets the upstream one command later.

**The governed-surface section no longer claims this repo has no mechanical backstop.** That
paragraph asserted there was no post-merge audit covering this repo and that "a backstop this
paragraph does not name is a backstop that does not exist". Both are measurably false today:
`.github/workflows/governed-surface-guard.yml` is live, and the sibling repo's report-only
merge audit has covered this repo since objectstack#9619. The replacement names the guard,
states that it is still report-only until the ruleset toggle is flipped, and points coverage
at the script's own list rather than re-asserting a closed inventory that goes stale the next
time a guard is added.
