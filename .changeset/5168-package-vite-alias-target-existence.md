---
---

Test-only gate extension, no behaviour and no authoring-surface change (objectui#5168).

`scripts/__tests__/vitest-config-alias-targets-3944.test.ts` enforced "every declared
alias target exists on disk" for two tables — the root `vitest.config.mts` alias table
(objectui#3944) and the root `tsconfig.json` `compilerOptions.paths` table, folded in by
objectui#4804. The package-level `vite.config.ts` alias tables were covered by nothing:
24 configs, 227 entries, 200 of them `@object-ui/*`.

The one other gate that reads those tables — `side-effects-declaration-consistency.test.ts` —
does not go red on a dead entry, and that is correct for its own question: an unresolvable
target contributes no entry form, so no `sideEffects` declaration can conflict with it. Target
existence and `sideEffects` declaration consistency are two different contracts, so this lands
in the file whose contract already is the former rather than being folded into that gate.

The parse is borrowed from that gate's AST reader rather than written a fifth time, because
across 24 files the table is spelled four ways (bare `resolve(`, `path.resolve(`, the array
`{ find, replacement }` form, and double-quoted keys) and a regex reader that understood one
of them had 15 configs contributing zero entries while staying green. A spelling-coverage case
asserts each of the four is demonstrably reachable, so a parser that stopped reading one goes
red instead of quietly shrinking the surface.

Two adjustments the root tables did not need: existence probes Vite's `resolve.extensions`
after the alias substitution (an extension-less target naming a file, such as `packages/runner`'s
`@/lib/utils` pointing at `utils.tsx`, is live), and the root half's "an extension-less target
must be a directory" case is deliberately not ported, because down here landing on a file is
the intended spelling.

One live dead entry was found by the new gate on its first run and is carved out as a
shrink-only ratchet rather than fixed here: `packages/runner`'s `"@app"` points at
`packages/runner/src/app-data`, which does not exist in any form, and nothing in the repo
imports `@app`. Whether the fix is to drop the line or restore the DX symlink its comment
names is a maintainer call — filed as objectui#5380.

No package is declared because nothing published changed: the diff is one file under
`scripts/__tests__/`.
