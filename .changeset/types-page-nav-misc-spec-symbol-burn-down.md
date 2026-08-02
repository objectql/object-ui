---
"@object-ui/types": minor
"@object-ui/mobile": minor
"@object-ui/core": minor
"@object-ui/components": minor
"@object-ui/plugin-grid": minor
"@object-ui/app-shell": minor
---

`@object-ui/types` stops declaring sixteen symbols under names `@objectstack/spec` owns (objectui#3156, objectstack#4115).

Seven are now **derived** from the spec, nine are **renamed** to the local
dialect they always were. Both halves remove the same hazard: a local
declaration under a spec export's name reads as the spec's own definition to
the next reader, so a copy that is merely *correct today* is a planted premise
tomorrow.

**Derived** — the spec now supplies the keys, by reference:

| symbol | derivation |
|:--|:--|
| `ActionParam` | `z.input<typeof ActionParamSchema>`, `type` widened to the local legacy spellings |
| `CreateExportJobRequest` | `Omit<CreateExportJobInput, 'object'>` (`object` is the method argument) |
| `CreateExportJobResult` | re-export from `@objectstack/spec/contracts` |
| `ImportRowResult` | re-export from `@objectstack/spec/api` |
| `NavigationArea` | spec keys, with `navigation` / `visible` pinned locally |
| `NavigationAreaSchema` | `specFieldsExcept(NavigationAreaSchema.shape, …)` |
| `Theme` | re-export of the spec's `ThemeInput` (the authoring shape) |
| `ExportJobFormat` | re-export of the spec's `ExportFormat` |

Four of these close real gaps rather than tidy names. `ActionParam` never
declared `reference` — the key `resolveActionParams()` actually reads for an
inline lookup target — nor `defaultFromRow`, which the metadata designer's own
inspector writes; it also narrowed `visible` to a bare string although the
resolver has always accepted the `{ dialect, source }` envelope too.
`CreateExportJobResult.createdAt` and `ImportRowResult.action` were optional
here and required by the server, leaving every consumer a branch that could
never run. And `NavigationArea`'s `id` now carries the spec's own length rule
instead of accepting any string.

**Renamed** — same word, different concept:

| was | now | why |
|:--|:--|:--|
| `FileMetadata` | `UploadedFileMetadata` | field-VALUE payload (`url`, `original_name`), not the storage file record |
| `GestureType` | `TouchGestureType` | direction-fused (`swipe-left`), not the spec's type+direction pair |
| `GestureConfig` | `TouchGestureConfig` | gesture→`action` binding, not per-gesture tuning |
| `OfflineConfig` | `PWAOfflineConfig` | service-worker route caching, not the offline data/sync model |
| `PageRegion` | `PageNodeRegion` | region of the renderer page NODE, holding `SchemaNode`s |
| `PageRegionSchema` | `PageNodeRegionSchema` | zod twin of the above |
| `ResponsiveConfig` | `MobileResponsiveConfig` | mobile box config, not the spec's SDUI grid contract |
| `WidgetManifest` | `RuntimeWidgetManifest` | SDUI component manifest, not the field-widget plugin manifest |
| `WidgetSource` | `RuntimeWidgetSource` | `module`/`inline`/`registry` loader union — and its `inline` carries a resolved component where the spec's carries source code |

**Migration**: the old names are gone, not deprecated — an alias would preserve
exactly the ambiguity being removed. Import the new name; nothing about the
shapes changed. `@object-ui/types` already re-exports the spec's own
`SpecResponsiveConfig`, and `@object-ui/react`'s `useOffline` config remains the
spec-shaped `OfflineConfig`, so both concepts stay reachable under
distinguishable names.

Each rename carries a bidirectional tripwire
(`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`): it fails if
the spec ever claims the new name, and also if the spec retires the old one —
at which point the natural name can be taken back rather than the workaround
outliving its reason.
