---
---

chore: delete the committed root screenshot `--full-page`, and ignore dash-prefixed root files

Release-nothing: removes a stray binary from the repository root and touches
`.gitignore` / `AGENTS.md` only — no package code changes.

The repository root carried a **tracked** 68KB PNG whose filename was literally
`--full-page` (1280x577). A screenshot CLI flag landed in the output-filename
slot and was committed alongside #3085, so every `git worktree add` since has
materialised the file into a fresh tree.

The existing safety net could not catch it. `.gitignore` anchors `/*.png` and
friends at the root precisely for stray screenshots, but this file has no
extension to match on — the flag *is* the name. `.gitignore` now also ignores
`/--*`: root-anchored, and matching the accident by its **shape** rather than
by its content type. Nothing legitimate lives at the repository root under a
flag name, so a root entry starting with `--` is an argument-parsing mistake by
construction. Nested paths are unaffected (`packages/**/--foo` still shows up).

Footnote for whoever meets the next one: a leading-dash filename is parsed as an
option by every CLI, so it needs `--` and an explicit path —
`git rm -- './--full-page'`, `rm -- ./--full-page`.
