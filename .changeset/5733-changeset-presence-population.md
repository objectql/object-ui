---
---

Tooling only; no published package behaviour changes.

`scripts/check-changeset-presence.mjs` counted a changed file as a package's source
only when it sat under `<pkg>/src/`. `apps/console/index.html` does not — it is the
console's HTML entry, compiled into the published `dist/`, and it carries two inline
classic scripts that run in every user's browser during parse. A pull request editing
only that file changed shipped console behaviour while the gate reported
`No source of a released package changed in this range` (objectui#5733).

The population is now the package's published, executable source: `<pkg>/src/`, plus
the bundler's HTML entry, plus whatever the package's own `package.json` `files` list
publishes verbatim — minus documentation and licences, which ship but are not
behaviour. On this tree the widening adds exactly three files
(`apps/console/index.html`, `apps/console/plugin.ts`, `packages/runner/index.html`)
and nothing else in any package directory.
