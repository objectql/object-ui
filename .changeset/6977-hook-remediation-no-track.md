---
---

PreToolUse-hook prose only: no published package's `src/` changed, so nothing ships.

**Both worktree guards now print `--no-track` in the recipe they emit when they block.**
`.claude/hooks/guard-main-checkout.sh` and `.claude/hooks/guard-main-checkout-bash.sh` each
end their block message with the worktree recipe to run instead, and both created the branch
with a plain `-b`. PR #6976 hardened the prescribed form in `CLAUDE.md` and `AGENTS.md`; the
hooks' copy was left behind, and it is the higher-leverage one — it is delivered at the exact
moment an agent is about to act, so it is the copy most likely to be run verbatim.

The hazard is the one #6976 established: plain `-b` writes the new branch's upstream keys
(`branch.NAME.remote`, `branch.NAME.merge`) into the one `.git/config` that every linked
worktree of a repo shares. That write can fail *after* the branch is created, leaving a branch
with no worktree — a half state the error text does not name. Read as "the worktree exists",
the agent starts editing the shared primary checkout, which is the one thing these two guards
exist to prevent. Measured on git 2.43.0 in #6976: `--no-track` removes the config write and
still bases the worktree on `origin/main`, and `git push -u origin BRANCH` sets the upstream
one command later.

Additive, not a recipe rewrite: this repo's hooks already emitted the fetch-hardened base
(`git fetch origin main && … origin/main`, landed for ui#6208), so the only surviving
divergence from the prescribed form was the missing flag. One word added per file, net ±0
lines in both.

Deliberately unchanged, each for its own reason:

- `.changeset/6208-worktree-recipe-fetch-base.md` quotes the pre-#6208 recipe as the record of
  a past change. Editing a historical changeset would rewrite that record (adjudicated in
  PR #6976).
- The two `-cmp` comparison-tree lines in `CLAUDE.md` / `AGENTS.md` create no branch and take
  an explicit ref from the caller, so there are no upstream keys to write and the flag does not
  apply — the same reading #6208 recorded for them.
- `.claude/hooks/guard-tree-enum.selftest.sh`'s allow-case is a command payload fed to a
  different guard to assert that ordinary commands pass through it. It is test input, not text
  any agent is told to run.

Verified by re-running all three self-test matrices this repo ships (`guard-main-checkout-bash`
121, `guard-shared-stash` 41, `guard-tree-enum` 36 — 0 failed each, unchanged from before the
edit, because no case pins the remediation string), and by invoking both hooks directly and
reading the text they emit.
