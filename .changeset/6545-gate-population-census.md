---
---

`check-readme-exports` now says **tracked** beside both of its counts, so its
green reads as "green over N tracked READMEs" rather than as a claim about the
`packages/` directory.

Both of that gate's walks are `git ls-files -- packages/`. A brand-new
`packages/<pkg>/README.md` that has not been `git add`-ed is outside the
population, so a local pre-flight run reports OK without ever having opened the
file — true of what it scanned, and silent about the one file its author was
asking about. Measured: planting an untracked `packages/census-probe-pkg/README.md`
left `census.readmes` at 43, and the verdict line was byte-identical to the clean
run. CI never sees this (a committed tree has no untracked files); it bites only
the local run, which is exactly where an author is trying to avoid a red push.

Found by a census of every `scripts/` gate that enumerates with `git ls-files`.
Four gates use it as their judged population; three of them
(`check-control-bytes`, `check-vi-mock-specifiers`, `check-vi-mock-inherit`)
already named it, and `check-readme-exports` was the one that did not. The
population is unchanged — only the sentence describing it. Widening a gate to
untracked files, or refusing to run on a dirty worktree, would change what these
gates mean and is deliberately not done here.

No package source, no published contract, no runtime behaviour changes.
