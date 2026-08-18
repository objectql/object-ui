---
'@object-ui/types': minor
'@object-ui/plugin-map': minor
---

`ObjectMapSchema` declares what ObjectMap reads, and the `map` block outranks the flat spelling

`object-map` carried three disagreeing shapes for one component. The declared face
(`ObjectMapSchema`) had four keys — `type`, `objectName`, `locationField`,
`titleField`, `mapStyle`. The renderer read about fifteen. And `ObjectMapProps.schema`
was typed `ObjectGridSchema`, so every map-specific read went through
`(schema as any)`. A TypeScript author could not write the `map` block the docs teach,
and misspelling `latitudeField` as `latitudeFieId` was caught by nothing: the map
rendered empty and looked like bad data.

Declared now, each with a read site in `ObjectMap.tsx`: `data`, `staticData`, `filter`,
`sort`, `map`, `enableClustering`, `navigation`. `ObjectMapConfig` (interface) and
`ObjectMapConfigSchema` (zod) are lifted out of `plugin-map`, where the zod was
package-private and called `MapConfigSchema`, into `@object-ui/types` and
`@object-ui/types/zod` — so the declared authoring face and the validation the renderer
performs are one schema rather than two that can drift. The `Object` prefix is not
decoration: `@objectstack/spec/automation` already exports `MapConfigSchema` for an
unrelated concept, and a local declaration under a spec export's name is what
`check:spec-symbols` exists to refuse. `ObjectMapProps.schema` is `ObjectMapSchema`, and the `as any` map reads
are gone.

Behavior change, ruled by the maintainer on objectui#5018 (2026-08-17): the `map` block
is the author face and the flat top-level spelling (`schema.latitudeField`, …) is the
internal form ObjectView / ListView produce when they flatten `options.map`. When a
schema carries both, **the `map` block now wins** — the reverse of the previous order,
under which the flatten product silently shadowed an authored block — and a dev-mode
warning names the top-level keys that were ignored. The flat spelling stays out of the
declared surface and out of the docs.

Nothing changes for views built by ObjectView / ListView: both flatteners emit the flat
keys and no `map` key at all, so the branch the flip reorders is never reached for their
output. That property is now pinned rather than assumed
(`plugin-view/src/__tests__/ObjectView.mapFlatten.test.tsx`).

Bound worth stating, because it limits what the typed surface can promise: `BaseSchema`
carries an index signature (`[key: string]: any`), so a misspelled key at the TOP level
still type-checks — for every component schema in the repo. The `map` BLOCK is closed,
which is what makes the card's headline typo a compile error.
