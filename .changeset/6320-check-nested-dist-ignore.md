---
'@object-ui/cli': patch
---

Fix `objectui check` scanning build output because its ignore list only excluded a
root-level `dist/` / `node_modules/` (objectui#6320).

`packages/cli/src/commands/check.ts` passed `ignore: ['node_modules/**', 'dist/**',
'.git/**']` to `globSync`. `glob` matches `ignore` patterns against the path relative to
`cwd`, so an unanchored `dist/**` / `node_modules/**` excludes only a directory of that
name at the scan root — every nested `packages/<name>/dist/`, `examples/<name>/dist/`,
`apps/<name>/dist/` (and their `node_modules/`) was still scanned. In a built workspace
this means `objectui check` re-reads the author's own schemas a second time from build
output, roughly doubling every count it reports (measured on this repository: 617 → 1047
files globbed after a full build) with nothing in the output explaining why.

The ignore patterns are now anchored at every depth (`'**/dist/**'`, `'**/node_modules/**'`),
matching the fix's stated intent: exclude build output and installed dependencies wherever
they live, not only at the project root. A root-level `dist/` / `node_modules/` remains
excluded, unchanged.

Confirmed before widening: no example, template, or docs fixture in this repository
authors a schema under a directory literally named `dist` — the widened pattern excludes
only generated content.
