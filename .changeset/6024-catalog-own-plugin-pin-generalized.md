---
---

Tests and test-config only, no shipped code touched: the catalog "entries use their own
plugin" pin in `examples/schema-catalog/test/catalog-gallery-render.test.tsx` is
generalized from the two hand-enumerated categories objectui#5113 and objectui#5856 left
it at (`plugin-view`, `plugin-grid`) to all thirteen `plugin-*` catalog categories.

The `category -> type` map is now DERIVED from the `register()` calls, by reusing
`deriveRegistryKeys` from `scripts/check-doc-component-types.mjs` and joining its
registration sites on the `packages/<dir>` that owns them — the same derivation
`scripts/regenerate-known-schema-types.mjs` already consumes. The value is a SET, which
`plugin-charts` requires (its entries author `chart` and `bar-chart`), and the rule stays
per entry rather than per category.

objectui#5113's RENDER half (a record that exists only in the gallery data source reaches
the screen) does not transfer to the eleven categories that author their data inline, so
it is replaced for them by a MOUNT half rather than degraded to the STRUCTURE half:
substituting every own-plugin node with an inert probe must put the probe's marker on
screen, which a stray node, a `type` that is not a node, and a node behind a satisfied
`hidden` cannot do. Data provenance is kept, unweakened, for the entries that bind to an
object the gallery fixture serves — derived per entry from `objectName`, not declared. The
gate states its own coverage split so breadth cannot be read as depth: 5 entries carry
structure + mount + data, 34 carry structure + mount, and `plugin-editor` / `plugin-map`
lose nothing to their `EXCLUSIONS` because the probe replaces the renderer that needs
Monaco and WebGL2.

The derivation earned its keep on its first run: the filing's hand-written table read
`plugin-form  form`, and `form` is registered by `packages/components`, not by
`@object-ui/plugin-form`. Both `plugin-form` entries are the third instance of
objectui#5113's class, ledgered against objectui#6167 with a case asserting they still
fail, so the ledger cannot rot green.

`examples/schema-catalog/tsconfig.test.json` gains `allowJs` (with `checkJs` off) and a
repo-root `rootDir`, the same answer `tsconfig.scripts.json` reached in objectui#3494 for
importing a plain-JS CI helper into a typed pin test.
