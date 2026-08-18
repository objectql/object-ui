---
'@object-ui/cli': patch
---

`objectui check`: the known-type list is now derived from the component registry instead of being a hand-written copy, which had drifted in both directions at once.

The command judged a schema's `type` against a seventeen-entry array typed by
hand into `packages/cli/src/commands/check.ts`. Nothing held that array against
the registry, and measured on `origin/main` @ `8378e9954` it was wrong in both
directions simultaneously:

- **Two phantoms.** `crud` and `gallery` were on the list and are registered by
  nothing. `objectui check` passed `{ "type": "crud" }` in silence while
  `SchemaRenderer` painted the OBJUI-001 "Unknown component type" panel for the
  very same file — measured, both halves. `CRUDSchema` still has its interface,
  zod mirror, validator branch and builder; what it has never had is a
  registration. For `gallery`, the registered spelling is `object-gallery`.
- **221 bare keys missing, plus every namespaced spelling.** `object-grid`,
  `object-form`, `card`, `div` and `view:grid` were all reported as
  `⚠️ Unknown schema type`. False warnings at that volume are not a cosmetic
  problem: they train authors to skip the output, which costs the phantom
  direction its only reader.

The list now lives in `packages/cli/src/utils/known-schema-types.ts`, generated
by `node scripts/regenerate-known-schema-types.mjs` from the same
`deriveRegistryKeys` derivation that judges documentation snippets, and held to
it by a bidirectional pin in
`scripts/__tests__/known-schema-types-derivation-5115.test.ts` — a key the
registry has and the list lacks fails, and so does a key the list has and the
registry lacks. Bare and namespaced spellings are both carried, because
`register('grid', C, { namespace: 'view' })` really does store both.

A runtime lookup through `ComponentRegistry` was measured and rejected: eleven
of the fifteen genuinely-registered entries come from plugin packages the CLI
does not depend on, and a published CLI runs against a user project whose plugin
set this repository cannot know either way.

**Behaviour change, in both directions.** `{ "type": "crud" }` and
`{ "type": "gallery" }` now produce the `Unknown schema type` warning they
always should have, and a large number of real component types stop producing
one. The warning remains advisory — it never changes the command's exit code,
which is still driven only by files that fail to parse — so no run that passed
before fails now.

`check()` additionally takes the directory to scan as an optional argument
(defaulting, as before, to `process.cwd()`), so the behaviour can be tested
against a fixture tree.
