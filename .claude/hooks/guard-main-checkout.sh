#!/usr/bin/env bash
# guard-main-checkout.sh — PreToolUse guard enforcing worktree-first discipline.
# Blocks Edit / Write / NotebookEdit while the session's checkout is on the repo's
# default branch (main).
#
# Why: this repo is worked on by multiple agents in parallel. The shared default
# checkout has its HEAD switched and the tree reset *under you* by other agents,
# silently clobbering uncommitted edits. Dedicated per-task worktrees are
# physically isolated, so edits there are safe. This guard turns the documented
# discipline into a hard stop for the one place it actually fails — editing on the
# shared default branch.
#
# Deliberate exception (a human quick-fix that still lands via PR, never task work
# committed straight to the default branch): export OS_ALLOW_MAIN_EDITS=1.

set -uo pipefail

# Escape hatch.
[ "${OS_ALLOW_MAIN_EDITS:-}" = "1" ] && exit 0

dir="${CLAUDE_PROJECT_DIR:-$PWD}"

# Not a git repo (or git unavailable) → nothing to guard, allow.
branch="$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null)" || exit 0

# Repo default branch (origin/HEAD), e.g. "main"; fall back to "main".
default="$(git -C "$dir" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)"
default="${default#origin/}"
[ -n "$default" ] || default="main"

if [ "$branch" = "$default" ]; then
  root="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$dir")"
  name="$(basename "$root")"
  cat >&2 <<EOF
⛔ Blocked: editing files while on the shared '$default' checkout (root=$root).

This repo is worked on by multiple agents in parallel — the shared '$default' tree
gets its HEAD switched and reset under you, silently clobbering uncommitted edits.

Per AGENTS.md (worktree-first), create a dedicated worktree and edit from there:

  git worktree add ../$name-<task> -b <branch> $default
  cd ../$name-<task> && pnpm install

Deliberate exception (not task work): re-run with OS_ALLOW_MAIN_EDITS=1.
EOF
  exit 2
fi

exit 0
