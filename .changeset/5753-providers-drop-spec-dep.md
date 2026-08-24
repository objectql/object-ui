---
'@object-ui/providers': patch
---

`@object-ui/providers` no longer declares `@objectstack/spec` as a dependency. Nothing
in the package imports it, so consumers stop installing it on this package's account
(objectui#5753).

The edge was live for exactly one release cycle. It was promoted from `devDependencies`
to `dependencies` when `ThemePreference` was derived from the spec's `ThemeMode` union,
because the package's public `.d.ts` then referenced the spec. objectui#5716 re-pointed
that derivation at `@object-ui/types` (`ThemeMode` / `THEME_MODES`), which removed the
last three import sites — `src/types.ts` and the two retirement-era test files — and
left the declaration behind with no reader.

Re-measured on `origin/main` at `ad0f5f11f` before removal, with a positive control so
the empty result is a real absence rather than a broken command: the import-shaped grep
(`from` / `require(` / `import(` / `vi.mock(` against `@objectstack/spec`, bare name and
every subpath) returns **0** hits under `packages/providers/` and **434** across
`packages/` + `apps/` — same command, same invocation. The only surviving mentions in
the package are the declaration itself, immutable `CHANGELOG.md` history, and a prose
comment in `tsconfig.test.json` that this change corrects.

No API change and no behaviour change: `dist/types.d.ts` imports only `react` and
`@object-ui/types`, and no emitted file references a spec symbol. Consumers on an
isolated `node_modules` (pnpm) never had supported access to the spec through this
package, so nothing they could legitimately import goes away — the change is to the
install graph only, which is why it is scored `patch` rather than `minor`.
