---
"@object-ui/cli": patch
---

Generated temp apps now declare every package they import, at ranges anchored to this repo

`objectui dev` / `serve` / `build` write a throwaway app into `<cwd>/.objectui-tmp`,
and the `package.json` they wrote named neither `lucide-react` nor any of the seven
`@object-ui/plugin-*` packages the generated sources import — while pinning
`@object-ui/react` and `@object-ui/components` at `^0.1.0`, a range that resolves to
nothing at all for packages published at 17.x (the registry has no 0.1.0). Outside
this workspace that manifest could not install; inside it, hoisting to the root
`node_modules` satisfied every missing name, so nothing was ever red.

**`lucide-react` is now declared** (objectui#3827). Both of its imports in the
generated layout are live — `import * as LucideIcons` feeds a `DynamicIcon` lookup
and four `LucideIcons.*` icons, and the named `{ Moon, Sun }` renders the theme
toggle — so this is the opposite disposition from the sibling generator, where
objectui#3755 removed an equivalent declaration precisely because nothing imported
it. Anchored to `^1.28.0`, the range all 23 in-repo manifests that import lucide
agree on. `commands/dev.ts` had been covering the gap in the consumer, aliasing
`lucide-react` to a path resolved out of `packages/components` "to avoid dependency
not found in temp app" — but only in monorepo mode, leaving every other path with an
unsatisfiable import. The declaration belongs at the producer; the alias is now a
workspace convenience rather than the only thing holding the import up.

**The seven plugin packages are now declared too**, in both generators. Measuring
the reported defect turned up that `src/App.tsx` side-effect-imports
`@object-ui/plugin-charts`, `-editor`, `-kanban`, `-markdown`, `-form`, `-grid` and
`-view` to register their components, and no manifest ever named them: the
undeclared set was eight packages, not the one the issue reported.

**`@object-ui/*` ranges are derived from this CLI's own version** instead of being
written out as literals. `.changeset/config.json` puts `@object-ui/cli` in the same
`fixed` group as every platform package a generated app depends on, so they always
publish at one version — which makes `^<own version>` both current and guaranteed to
exist on the registry. A literal here is not merely a fossil risk but a fossil
generator: that group re-versions on every release, so any hard-coded range is stale
the next day. This is how `^0.1.0` survived to sit 16 majors behind.

**The toolchain ranges are anchored to in-repo manifests**, the discipline
objectui#3742/objectui#3754 established: `vite ^5.0.0` → `^8.2.0`, `typescript
~5.7.3` → `^6.0.3`, `@vitejs/plugin-react ^4.2.1` → `^6.0.5`, `react`/`react-dom`
`^18.3.1` → `19.2.8` with `@types/*` to match, `react-router-dom ^7.12.0` →
`^7.18.2`, `postcss ^8.5.6` → `^8.5.26`, `autoprefixer ^10.4.23` → `^10.5.4`. React
quotes the root's installed version rather than the wider `^18 || ^19` the platform
packages accept as a peer: the peer says what can work, the root says what the
generated code has actually run against, and inside this workspace the temp app
resolves React by hoisting to the root.

`tailwindcss` is deliberately left at `^3.4.19`. This repo is on Tailwind 4 and
`@object-ui/components` peers `^4.2.1`, so the range is not merely behind — it
conflicts. But re-anchoring it is not a version edit: the generated `index.css` uses
v3 directives, the generated `postcss.config.js` names the plugin key v4 moved to
`@tailwindcss/postcss`, and the generated `tailwind.config.js` is a v3 config. Raising
the range without rewriting those three files yields an app that installs and renders
unstyled, which looks fixed and is worse. Filed separately as objectui#3852; kept
internally consistent at v3 until then, and pinned as a deliberate deferral rather
than left to read as drift.

The generators now build their output as a file map that the writers spill to disk,
so tests assert over the same artifact the CLI writes. Three structural gates port
the ones the sibling generator grew: every bare import must be declared, no versioned
runtime dependency may be declared that nothing imports, and no generated `src/**`
file may be unreachable from `src/main.tsx` — the one module `index.html` loads. Each
is paired with a self-test that plants the defect back. Note for the next port: the
`create-plugin` import scanner matches single-quoted specifiers only, and these
templates mix quote styles, so a verbatim copy would have been blind to
`from "lucide-react"` — one of the two lines this issue reports.
