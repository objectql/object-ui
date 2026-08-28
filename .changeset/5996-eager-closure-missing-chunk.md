---
---

Build tooling only — `apps/console/vite.config.ts`, which is not published
source (`@object-ui/console`'s `files` list carries `dist`, `plugin.*` and
`README.md`), so nothing ships from this change.

`emit-eager-closure-report`'s `writeBundle` hook read every member of the eager
closure off disk with an unguarded `fs.readFileSync`. The closure walk seeds
itself from `chunk.imports`, and rolldown lists a chunk's EXTERNAL imports in
that array beside the file names of real chunks — so a bare specifier vite could
not resolve joins the closure under its own name and is then read as a path. The
result was a bare `ENOENT` from `node:fs`, several frames from the cause, naming
neither the plugin nor the unresolved import.

The read is now guarded by an existence check that `this.error()`s with the
missing name, the chunk that imports it, and the diagnosis. The failure stays
loud — that direction is correct, and the two counter-probes above it exist to
keep it that way; only its message changes.
