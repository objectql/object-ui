---
'@object-ui/core': patch
'@object-ui/react': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-report': patch
---

Analytics: the dimension label net's fetch-and-memo glue is written once, not once per surface

PR #4388 (objectui#4330) put the same React glue on two surfaces — the dashboard's `DatasetWidget` and plugin-report's dataset block. The resolution RULES were never duplicated (both call the same `@object-ui/core` helpers), but the wiring around them was: read the object schema through the host's authenticated `apiFetch`, keep the fetched metadata locale-free in state, derive the label maps in a render memo. Two copies meant two statements of the same two bug fixes, which is a drift surface rather than a defect — nothing a user could hit today, filed as objectui#4389 so it was retired deliberately.

It is now split along the layer that can actually hold each half. `@object-ui/core` gains the React-free parts — `loadDimensionFieldMeta` (the base-object read composed with the dimension walk), `deriveDimensionLabelMaps` (the locale-applying derivation) and `dimensionOptionTranslator` (binding the bundle resolver to the object that OWNS a terminal field, which for a dotted path is the relationship target). `@object-ui/react` gains `useDatasetDimensionLabels` / `useDatasetDimensionMeta`, the React wiring that cannot live in core, beside the `useViewData` / `useElementDataSource` / `useDiscovery` hooks that already read `SchemaRendererContext` the same way. Both plugins consume it; the dashboard keeps its chart-only per-category colour and category-order derivation layered locally, since a table renders no palette.

The card originally proposed `@object-ui/core` as the whole glue's home. That home was disproven by measurement and retired in the card's PM RULING #2: `SchemaRendererContext` is defined in `@object-ui/react`, which depends on core, so core importing it back is a cycle — and core is React-free by declaration, by content, and by the topology in AGENTS.md. objectui#3367 had already ruled this direction for the same family (core-canonical logic, react re-exports).

Behaviour is unchanged by construction: same read count, same best-effort fallback, same memoization boundary. The two bug fixes are now stated once and pinned at the shared hook — the read rides the host's authenticated `apiFetch` (objectui#4121, pinned by asserting that a new channel re-issues the read, i.e. that it really is in the effect's deps), and the fetched metadata stays locale-free (objectui#4030 / PR #4324, pinned by switching language at runtime and asserting the labels flip with no second metadata read). All 39 assertions PR #4388 landed across both surfaces pass unchanged, and their files are byte-identical to before.
