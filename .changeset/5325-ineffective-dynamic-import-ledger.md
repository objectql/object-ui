---
---

Build tooling only, no published package source changed.

The console build emitted 43 `INEFFECTIVE_DYNAMIC_IMPORT` warnings on every run
— every `import()` in `@object-ui/fields`' widget-loader map is defeated by a
static edge to the same module. They are true, and they scroll past every build
until nobody reads the log at all.

They are now pinned to a ledger (`scripts/vite-ineffective-dynamic-imports.ts`)
rather than filtered away: the pinned 43 are replaced by one summary line, an
ineffective dynamic import the ledger does NOT know about keeps rolldown's
original warning and fails the build, and a pinned entry that stops firing fails
it too — so a build that dies before chunk assignment reports 43 named absences
instead of a clean-looking zero.

The module graph is deliberately unchanged; the ledger's header carries the
measurement of why, and the eager-closure budget already governs the bytes.
