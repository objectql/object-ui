---
"@object-ui/create-plugin": patch
---

Anchor the scaffold's build-side `devDependencies` to this repo's real toolchain, and pin the whole generated manifest against drift

A freshly scaffolded plugin declared a build stack one to two majors behind the one this monorepo actually builds and tests every in-tree plugin with: `vite ^7.3.1` against the repo's `^8.2.0`, `@vitejs/plugin-react ^4.2.1` against `^6.0.5`, `vite-plugin-dts ^4.5.4` against `^5.0.3`, `typescript ^5.9.3` against `^6.0.3`, `vitest ^4.0.18` against `^4.1.10`. Those five ranges were never sourced from anything — objectui#3716's end-to-end run of the generated artifact only ever exercised the versions installed in this repo, so the declared ranges were not the ones under test. All five now quote an in-repo anchor, the same way the three testing ranges already did.

Two anchors, because the root manifest does not declare everything. `create-plugin` writes into `<cwd>/packages/plugin-<name>`, so a generated plugin is a literal sibling of `packages/plugin-*`; those manifests anchor the two build-only tools the root omits (`@vitejs/plugin-react`, `vite-plugin-dts`), and the root anchors the rest.

The parity test now covers **every** entry of the generated `devDependencies` rather than the three testing ones, including a completeness check that fails when a dependency is added without naming its anchor — the five build ranges drifted precisely because nothing pinned them. It also asserts the two anchors agree wherever both declare a dependency, so which one is read cannot hide a drift.

The generated `vite.config.ts` resolves its library entry from `import.meta.dirname` instead of `__dirname`. vite 8 still defines `__dirname` under its default `bundle` config loader but warns on it ("unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite ... Use `import.meta.dirname` instead"), and under `native` — which imports the config with Node's own ESM loader, where no `__dirname` exists — the generated config failed to load outright. `apps/console/vite.config.ts` was converted for the same reason in objectui#3384.

Not a peer-dependency fix: `@vitejs/plugin-react ^4.2.1` resolved to 4.7.0, whose vite peer had widened to `^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0` and accepted the declared `vite ^7.3.1`, so the old manifest installed cleanly. The cost was a scaffold lagging its own monorepo, not a failing install.
