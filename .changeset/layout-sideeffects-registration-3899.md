---
"@object-ui/layout": patch
---

`@object-ui/layout` no longer tells bundlers it has no side effects while registering components at load time (objectui#3899)

The published manifest declared `"sideEffects": false` — a promise that no module
in the package does anything on evaluation, so any module whose exports go unused
may be dropped whole. But `src/index.ts` ends with a bare
`try { registerLayout(); } catch {}`, and that call is the only thing that puts
`page-header`, `page:card`, `app-shell`, `responsive-grid`,
`navigation-renderer` and `app-schema-renderer` into the `ComponentRegistry`.

Both statements cannot be true, and a bundler that believes the manifest is
right to delete the registration. Measured with the repo's own bundler by
building `import '@object-ui/layout';` — the side-effect-only import, i.e. the
documented "import it to register" pattern:

- `sideEffects: false` — the bundle is **0 bytes**. Zero registrations, exit
  code 0, no warning.
- after this change — the bundle keeps all six `ComponentRegistry.register`
  calls.

A dropped registration does not fail where it happened. It surfaces later as a
red `Unknown component type` panel (OBJUI-001) on a fully green build, with
nothing in the build log to connect the two. Nobody had been bitten yet only
because every consumer today ALSO imports a named export, which forces the module
to be evaluated regardless — coincidence, not design. objectui#3787 met the
hazard and routed around it by calling `registerLayout()` explicitly.

`sideEffects` is now the narrowest honest answer: an array naming the modules
that actually register, rather than `true`, which would be honest but would hand
the whole package to every bundler as unshakeable.

```json
"sideEffects": ["./dist/index.js", "./dist/index.umd.cjs", "./src/index.ts"]
```

All three are load-bearing, and the set is derived from the manifest rather than
guessed:

- `./dist/index.js` and `./dist/index.umd.cjs` are every JS file the manifest's
  own entry fields point at (`module` / `main` / `exports` import+require). The
  library build inlines everything into those two files, so there is no third
  chunk to name.
- `./src/index.ts` is not published (`files` ships `dist` only) but is bundled
  for real: `apps/console` and `examples/console-starter` both alias the
  specifier straight at `packages/layout/src`, and a bundler reads this same
  manifest for those files. With only the published paths declared, the console's
  alias shape still produced a 0-byte bundle.

What deliberately did NOT change: the load-time `registerLayout()` itself.
Replacing it with an explicit registration API is the opposite direction — it
eliminates the side effect instead of declaring it, and it is breaking for any
consumer relying on automatic registration. objectui#3899 leaves that call to the
maintainer, and the two steps do not conflict: once the manifest tells the truth,
the migration to explicit registration can happen whenever it is wanted.

A new pin (`packages/layout/src/__tests__/side-effects-manifest.test.ts`) runs a
real bundler build per entry form and asserts the registrations survive a
side-effect-only import, with a `sideEffects: false` control per form asserting
they are dropped — so the pin cannot pass because the bundler stopped shaking
anything. The required set is derived from the manifest's own entry fields, so a
renamed build output or a new `exports` subpath fails as a missing declaration
instead of drifting silently.
