---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/react": minor
"@object-ui/app-shell": minor
"@object-ui/layout": minor
"@object-ui/fields": minor
"@object-ui/components": minor
"@object-ui/plugin-designer": patch
---

Stop declaring 14 symbols under names `@objectstack/spec` owns at `17.0.0-rc.6`
(objectui#4167, objectstack#4115).

The rc.6 bump published nine names this repo already declared locally, on top of
four that predate it — `check:spec-symbols` reported all thirteen at once, and a
fourteenth (`GlobalFilterSchema`) appeared during the bump itself. Each was
triaged on its own rather than blanket-renamed, because the right answer differs
per symbol: five bind to the spec, three are renamed because the spec's
same-named export means something else, five arrive by derivation, and one is a
declared dialect with a written reason.

**Breaking for importers of `@object-ui/react`, `@object-ui/app-shell` and
`@object-ui/types`** — three exported names changed, because the spec exports the
same name for a *different* thing:

| package | was | now | what the spec's same-named export actually is |
|:--|:--|:--|:--|
| `react` / `app-shell` | `MetadataState` | `MetadataCacheState` | a metadata item's LIFECYCLE state — `'draft' \| 'active' \| 'deprecated' \| 'archived'` (`MetadataStateSchema`, `@objectstack/spec/system`) |
| `react` / `app-shell` | `resolveI18nLabel` | `resolveKeyedI18nLabel` | a resolver for the INLINE per-locale map (`{ en: 'Owner', 'zh-CN': '负责人' }`) against a BCP-47 locale |
| `types` | `DateRangePreset` | `FilterBuilderDateRangePreset` | the thirteen HISTORICAL dashboard filter-bar presets; this one is the filter-builder set, which adds eight FUTURE windows the dashboard schema rejects |

`resolveI18nLabel` is the one where the collision had already started costing
something. rc.6 widened `I18nLabel` from `string` to
`string | Record< string, string >`, so the same authored value now reaches
either resolver — and each answers wrongly, silently, for the other's input: the
keyed one returns `undefined` for `{ en: 'Owner' }` (no `key`, no
`defaultValue`), and the spec's reads `key` / `defaultValue` / `params` as locale
tags. The rc.6 bump PR met this and aliased the spec's import as
`resolveInlineI18nLabel` in five files, with hand-written comments at two of
them. That is a review convention, which is what objectstack#4115 exists to
replace with a rule — so `Keyed` is now the counterpart of that `Inline`, and the
name says which vocabulary it resolves at every call site.

**Eleven keep their names and are now imported or derived from the spec** instead
of re-declared: `DATE_RANGE_PRESETS`, `NavigationMode`, `AddressValue`,
`BreakpointColumnMap`, `BreakpointOrderMap`, `KanbanConfig`, `CalendarConfig`,
`GanttConfig`, plus the three renamed above at their new names.

**Four of the copies were losing information, not just duplicating it.**

- **`GanttConfig` declared six keys and called itself canonical; rc.6's
  `GanttConfigSchema` declares seventeen.** The eleven it never mentioned —
  `parentField`, `typeField`, `baselineStartField`, `baselineEndField`,
  `groupByField`, `resourceView`, `assigneeField`, `effortField`, `capacity`,
  `quickFilters`, `autoZoomToFilter` — are all read by
  `plugin-gantt/src/ObjectGantt.tsx`, through a local `GanttConfigEx`
  intersection that existed only because this type did not carry them. It now
  derives from the spec, with `timeSegments` (shift segmentation) as the one
  genuinely local extension; the schema is `$loose` upstream, so that key is
  legal metadata rather than a second dialect.
- **`GanttConfig.tooltipFields` carried the comment "not part of the upstream
  GanttConfigSchema".** It is, as of rc.6, so the key now arrives from the spec.
- **`AddressValue` declared five of the spec's seven parts** — `countryCode` and
  `formatted` were missing, under a comment already claiming to be "the part
  names of `AddressSchema`". The widget still renders five inputs; binding the
  type stops it from asserting the platform cannot store the other two, and makes
  the `{ ...address }` write-through say so.
- **`DATE_RANGE_PRESETS` was `Object.keys(PRESET_RANGES)`,** a third copy of a
  vocabulary the spec extracted in objectstack#4614 precisely to collapse — its
  own doc comment names this module as one of the three. It is now the spec's
  array by reference, and the local date-macro bounds table is pinned complete
  against it with `satisfies`, so a preset the schema gains without bounds here
  is a compile error rather than a filter that validates clean and then selects
  nothing.

`NavigationMode` was one hop from the spec already (`NavigationConfig['mode']`);
it is bound directly, with a both-directions type pin that it stays the same type
as the config's own `mode`. `KanbanConfig` / `CalendarConfig` /
`BreakpointColumnMap` / `BreakpointOrderMap` were exact hand copies of `$strict`
schemas and are now re-exports — "still exact" is the argument for binding them,
since a copy with nothing to protect can only drift.

`GlobalFilterSchema` is the one ALLOW entry. It is the same spread-composition
dialect as `SelectOptionSchema` next to it, and it collided only because rc.6's
new refinement forced `.extend()` to be respelled as a `.shape` spread — which
moved a derivation the guard could see into an object literal it deliberately
does not descend into. The dialect is unchanged and its three divergences are
pinned; which side moves on the refinement itself is objectui#4165.

`@objectstack/spec` moves from `devDependencies` to `dependencies` in
`@object-ui/layout`: its public type surface now references the spec.
